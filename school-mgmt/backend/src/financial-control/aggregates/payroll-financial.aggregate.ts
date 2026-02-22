import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payroll, PayrollDocument } from '../../payroll/schemas/payroll.schema';
import { StaffPayroll, StaffPayrollDocument } from '../../staff-payroll/schemas/staff-payroll.schema';

type DateFilter = { $gte?: Date; $lte?: Date };

type PayrollPaidBreakdown = {
  teacherTotal: number;
  teacherCount: number;
  staffTotal: number;
  staffCount: number;
  total: number;
  count: number;
};

@Injectable()
export class PayrollFinancialAggregateService {
  constructor(
    @InjectModel(Payroll.name) private readonly payrollModel: Model<PayrollDocument>,
    @InjectModel(StaffPayroll.name) private readonly staffPayrollModel: Model<StaffPayrollDocument>,
  ) {}

  async getPaidOutflowTimeline(
    groupBy: 'day' | 'month' = 'day',
    dateFilter?: DateFilter,
  ): Promise<Array<{ _id: string; totalAmount: number; count: number }>> {
    const format = groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d';

    const [teacherRows, staffRows] = await Promise.all([
      this.payrollModel.aggregate([
        {
          $match: {
            status: 'PAID',
            ...(dateFilter ? { paidAt: dateFilter } : {}),
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format,
                date: { $ifNull: ['$paidAt', '$createdAt'] },
              },
            },
            totalAmount: { $sum: '$netAmount' },
            count: { $sum: 1 },
          },
        },
      ]),
      this.staffPayrollModel.aggregate([
        {
          $match: {
            status: 'PAID',
            ...(dateFilter ? { paidAt: dateFilter } : {}),
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format,
                date: { $ifNull: ['$paidAt', '$createdAt'] },
              },
            },
            totalAmount: { $sum: '$netAmount' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const byDate = new Map<string, { _id: string; totalAmount: number; count: number }>();
    const merge = (rows: any[]) => {
      for (const row of rows) {
        const key = row._id as string;
        const prev = byDate.get(key) || { _id: key, totalAmount: 0, count: 0 };
        byDate.set(key, {
          _id: key,
          totalAmount: prev.totalAmount + (row.totalAmount || 0),
          count: prev.count + (row.count || 0),
        });
      }
    };

    merge(teacherRows);
    merge(staffRows);

    return Array.from(byDate.values()).sort((a, b) => a._id.localeCompare(b._id));
  }

  async getPaidSummary(dateFilter?: DateFilter): Promise<{ total: number; count: number }> {
    const breakdown = await this.getPaidSummaryBreakdown(dateFilter);
    return {
      total: breakdown.total,
      count: breakdown.count,
    };
  }

  async getPaidSummaryBreakdown(dateFilter?: DateFilter): Promise<PayrollPaidBreakdown> {
    const [teacher, staff] = await Promise.all([
      this.payrollModel.aggregate([
        { $match: { status: 'PAID', ...(dateFilter ? { paidAt: dateFilter } : {}) } },
        { $group: { _id: null, total: { $sum: '$netAmount' }, count: { $sum: 1 } } },
      ]),
      this.staffPayrollModel.aggregate([
        { $match: { status: 'PAID', ...(dateFilter ? { paidAt: dateFilter } : {}) } },
        { $group: { _id: null, total: { $sum: '$netAmount' }, count: { $sum: 1 } } },
      ]),
    ]);

    const teacherTotal = teacher[0]?.total || 0;
    const teacherCount = teacher[0]?.count || 0;
    const staffTotal = staff[0]?.total || 0;
    const staffCount = staff[0]?.count || 0;

    return {
      teacherTotal,
      teacherCount,
      staffTotal,
      staffCount,
      total: teacherTotal + staffTotal,
      count: teacherCount + staffCount,
    };
  }

  async getApprovedPayables(): Promise<{ total: number; count: number }> {
    const [teacher, staff] = await Promise.all([
      this.payrollModel.aggregate([
        { $match: { status: 'APPROVED' } },
        { $group: { _id: null, total: { $sum: '$netAmount' }, count: { $sum: 1 } } },
      ]),
      this.staffPayrollModel.aggregate([
        { $match: { status: 'APPROVED' } },
        { $group: { _id: null, total: { $sum: '$netAmount' }, count: { $sum: 1 } } },
      ]),
    ]);

    return {
      total: (teacher[0]?.total || 0) + (staff[0]?.total || 0),
      count: (teacher[0]?.count || 0) + (staff[0]?.count || 0),
    };
  }

  async getPaidTotalSince(since: Date): Promise<number> {
    const summary = await this.getPaidSummary({ $gte: since });
    return summary.total;
  }

  async getPendingLiabilities(): Promise<{ total: number; count: number }> {
    const [teacher, staff] = await Promise.all([
      this.payrollModel.aggregate([
        { $match: { status: { $in: ['PENDING_REVIEW', 'APPROVED'] } } },
        { $group: { _id: null, total: { $sum: '$netAmount' }, count: { $sum: 1 } } },
      ]),
      this.staffPayrollModel.aggregate([
        { $match: { status: { $in: ['PENDING_REVIEW', 'APPROVED'] } } },
        { $group: { _id: null, total: { $sum: '$netAmount' }, count: { $sum: 1 } } },
      ]),
    ]);

    return {
      total: (teacher[0]?.total || 0) + (staff[0]?.total || 0),
      count: (teacher[0]?.count || 0) + (staff[0]?.count || 0),
    };
  }
}
