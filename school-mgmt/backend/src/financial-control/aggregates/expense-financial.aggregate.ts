import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Expense, ExpenseDocument } from '../../expenses/schemas/expense.schema';

type DateFilter = { $gte?: Date; $lte?: Date };

@Injectable()
export class ExpenseFinancialAggregateService {
  constructor(
    @InjectModel(Expense.name) private readonly expenseModel: Model<ExpenseDocument>,
  ) {}

  private buildPaidPipeline(dateFieldAlias: string, dateFilter?: DateFilter): any[] {
    return [
      { $match: { paymentStatus: 'PAID' } },
      {
        $addFields: {
          [dateFieldAlias]: { $ifNull: ['$paidAt', '$expenseDate'] },
        },
      },
      ...(dateFilter ? [{ $match: { [dateFieldAlias]: dateFilter } }] : []),
    ];
  }

  async getPaidOutflowTimeline(
    groupBy: 'day' | 'month' = 'day',
    dateFilter?: DateFilter,
  ): Promise<Array<{ _id: string; totalAmount: number; count: number }>> {
    const format = groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';
    return this.expenseModel.aggregate([
      ...this.buildPaidPipeline('expenseCashDate', dateFilter),
      {
        $group: {
          _id: {
            $dateToString: {
              format,
              date: '$expenseCashDate',
            },
          },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          byCategory: { $push: { category: '$category', amount: '$amount' } },
        },
      },
      { $sort: { _id: 1 } },
    ]);
  }

  async getPaidCategorySummary(
    dateFilter?: DateFilter,
  ): Promise<Array<{ _id: string; totalAmount: number; count: number }>> {
    return this.expenseModel.aggregate([
      ...this.buildPaidPipeline('expenseRecognizedDate', dateFilter),
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);
  }

  async getApprovedPayables(): Promise<{ total: number; count: number }> {
    const rows = await this.expenseModel.aggregate([
      { $match: { paymentStatus: 'APPROVED_UNPAID' } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);

    return {
      total: rows[0]?.total || 0,
      count: rows[0]?.count || 0,
    };
  }

  async getPaidTotalSince(since: Date): Promise<number> {
    const rows = await this.expenseModel.aggregate([
      ...this.buildPaidPipeline('expenseRecognizedDate', { $gte: since }),
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return rows[0]?.total || 0;
  }

  async getPendingLiabilities(): Promise<{ total: number; count: number }> {
    const rows = await this.expenseModel.aggregate([
      { $match: { paymentStatus: { $in: ['PENDING_APPROVAL', 'APPROVED_UNPAID'] } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]);

    return {
      total: rows[0]?.total || 0,
      count: rows[0]?.count || 0,
    };
  }
}
