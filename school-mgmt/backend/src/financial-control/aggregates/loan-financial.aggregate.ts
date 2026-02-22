import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Loan, LoanDocument } from '../../loans/schemas/loan.schema';
import { LoanPayment, LoanPaymentDocument, LoanPaymentStatus } from '../../loans/schemas/loan-payment.schema';
import { BankTransaction, BankTransactionDocument } from '../schemas/bank-transaction.schema';

type DateFilter = { $gte?: Date; $lte?: Date };

@Injectable()
export class LoanFinancialAggregateService {
  constructor(
    @InjectModel(Loan.name) private readonly loanModel: Model<LoanDocument>,
    @InjectModel(LoanPayment.name) private readonly loanPaymentModel: Model<LoanPaymentDocument>,
    @InjectModel(BankTransaction.name) private readonly bankTransactionModel: Model<BankTransactionDocument>,
  ) {}

  private getOutstandingExpr(): any {
    return {
      $max: [
        0,
        {
          $subtract: [
            '$totalAmount',
            { $ifNull: ['$paidAmount', 0] },
          ],
        },
      ],
    };
  }

  private getPaidAmountExpr(): any {
    return {
      $ifNull: [
        '$paidAmount',
        {
          $cond: [{ $eq: ['$status', LoanPaymentStatus.PAID] }, '$totalAmount', 0],
        },
      ],
    };
  }

  private getPaidPrincipalExpr(): any {
    return {
      $ifNull: [
        '$paidPrincipal',
        {
          $cond: [{ $eq: ['$status', LoanPaymentStatus.PAID] }, '$principalAmount', 0],
        },
      ],
    };
  }

  private getPaidInterestExpr(): any {
    return {
      $ifNull: [
        '$paidInterest',
        {
          $cond: [{ $eq: ['$status', LoanPaymentStatus.PAID] }, '$interestAmount', 0],
        },
      ],
    };
  }

  async getDisbursementTimeline(
    groupBy: 'day' | 'month' = 'day',
    dateFilter?: DateFilter,
  ): Promise<Array<{ _id: string; totalAmount: number; count: number }>> {
    const format = groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';
    return this.bankTransactionModel.aggregate([
      {
        $match: {
          category: 'LOAN_DISBURSEMENT',
          ...(dateFilter ? { transactionDate: dateFilter } : {}),
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format,
              date: '$transactionDate',
            },
          },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
  }

  async getRepaymentTimeline(
    groupBy: 'day' | 'month' = 'day',
    dateFilter?: DateFilter,
  ): Promise<Array<{
    _id: string;
    totalAmount: number;
    totalPrincipal: number;
    totalInterest: number;
    count: number;
  }>> {
    const format = groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';
    // BUG #4 fix: use LoanPayment model (has principal/interest breakdown) instead of BankTransaction
    // BankTransaction only stores total amount; LoanPayment stores paidPrincipal + paidInterest
    const paidDateMatch = dateFilter ? dateFilter : { $ne: null };
    return this.loanPaymentModel.aggregate([
      {
        $match: {
          // Include OVERDUE installments that already have paidAmount/paidDate,
          // otherwise cash-flow misses real repayment outflow.
          status: { $in: [LoanPaymentStatus.PAID, LoanPaymentStatus.PARTIAL, LoanPaymentStatus.OVERDUE] },
          paidDate: paidDateMatch,
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format,
              date: '$paidDate',
            },
          },
          totalAmount: { $sum: this.getPaidAmountExpr() },
          totalPrincipal: { $sum: this.getPaidPrincipalExpr() },
          totalInterest: { $sum: this.getPaidInterestExpr() },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
  }

  async getInterestExpenseSummary(dateFilter?: DateFilter): Promise<{
    totalInterest: number;
    totalPaid: number;
    count: number;
  }> {
    const paidDateMatch = dateFilter ? dateFilter : { $ne: null };
    const rows = await this.loanPaymentModel.aggregate([
      {
        $match: {
          status: { $in: [LoanPaymentStatus.PAID, LoanPaymentStatus.PARTIAL, LoanPaymentStatus.OVERDUE] },
          paidDate: paidDateMatch,
        },
      },
      {
        $group: {
          _id: null,
          totalInterest: { $sum: this.getPaidInterestExpr() },
          totalPaid: { $sum: this.getPaidAmountExpr() },
          count: { $sum: 1 },
        },
      },
    ]);

    return {
      totalInterest: rows[0]?.totalInterest || 0,
      totalPaid: rows[0]?.totalPaid || 0,
      count: rows[0]?.count || 0,
    };
  }

  async getDebtSummary(statuses: string[] = ['ACTIVE']): Promise<{
    totalDebt: number;
    totalPrincipal: number;
    count: number;
  }> {
    const rows = await this.loanModel.aggregate([
      { $match: { status: { $in: statuses } } },
      {
        $group: {
          _id: null,
          totalDebt: { $sum: '$remainingBalance' },
          totalPrincipal: { $sum: '$principal' },
          count: { $sum: 1 },
        },
      },
    ]);

    return {
      totalDebt: rows[0]?.totalDebt || 0,
      totalPrincipal: rows[0]?.totalPrincipal || 0,
      count: rows[0]?.count || 0,
    };
  }

  async getUpcomingOutstandingSummary(until: Date): Promise<{ total: number; count: number }> {
    const rows = await this.loanPaymentModel.aggregate([
      {
        $match: {
          status: { $in: [LoanPaymentStatus.SCHEDULED, LoanPaymentStatus.OVERDUE, LoanPaymentStatus.PARTIAL] },
          dueDate: { $lte: until },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: this.getOutstandingExpr() },
          count: { $sum: 1 },
        },
      },
    ]);

    return {
      total: rows[0]?.total || 0,
      count: rows[0]?.count || 0,
    };
  }

  async getOverdueOutstandingSummary(): Promise<{ total: number; count: number }> {
    const rows = await this.loanPaymentModel.aggregate([
      { $match: { status: LoanPaymentStatus.OVERDUE } },
      {
        $group: {
          _id: null,
          total: { $sum: this.getOutstandingExpr() },
          count: { $sum: 1 },
        },
      },
    ]);

    return {
      total: rows[0]?.total || 0,
      count: rows[0]?.count || 0,
    };
  }

  async getNearMaturityLoans(until: Date): Promise<any[]> {
    return this.loanModel.find({
      status: 'ACTIVE',
      endDate: { $lte: until },
    }).lean();
  }
}
