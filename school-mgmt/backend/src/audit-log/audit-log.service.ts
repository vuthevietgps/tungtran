import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery } from 'mongoose';
import { AuditLog, AuditLogDocument, AuditAction, AuditModule } from './schemas/audit-log.schema';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';

export interface LogEntryParams {
  userId?: string;
  userEmail?: string;
  userFullName?: string;
  userRole?: string;
  action: AuditAction;
  module: AuditModule;
  targetId?: string;
  targetName?: string;
  description: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  ipAddress?: string;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
  ) {}

  async log(params: LogEntryParams): Promise<AuditLog> {
    try {
      const entry = new this.auditLogModel(params);
      return await entry.save();
    } catch (err) {
      // Audit logging should never break the main flow
      console.error('Audit log error:', err);
      return params as any;
    }
  }

  async findAll(query: QueryAuditLogDto) {
    const filter: FilterQuery<AuditLogDocument> = {};

    if (query.userId) filter.userId = query.userId;
    if (query.action) filter.action = query.action;
    if (query.module) filter.module = query.module;
    if (query.targetId) filter.targetId = query.targetId;

    if (query.search) {
      filter.$or = [
        { description: { $regex: query.search, $options: 'i' } },
        { userFullName: { $regex: query.search, $options: 'i' } },
        { userEmail: { $regex: query.search, $options: 'i' } },
        { targetName: { $regex: query.search, $options: 'i' } },
      ];
    }

    if (query.fromDate || query.toDate) {
      filter.createdAt = {};
      if (query.fromDate) filter.createdAt.$gte = new Date(query.fromDate);
      if (query.toDate) filter.createdAt.$lte = new Date(query.toDate);
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.auditLogModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.auditLogModel.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getStats() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [todayCount, weekCount, totalCount, byModule, byAction, recentActivity] = await Promise.all([
      this.auditLogModel.countDocuments({ createdAt: { $gte: today } }),
      this.auditLogModel.countDocuments({ createdAt: { $gte: weekAgo } }),
      this.auditLogModel.countDocuments(),
      this.auditLogModel.aggregate([
        { $match: { createdAt: { $gte: weekAgo } } },
        { $group: { _id: '$module', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.auditLogModel.aggregate([
        { $match: { createdAt: { $gte: weekAgo } } },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      this.auditLogModel.aggregate([
        { $match: { createdAt: { $gte: weekAgo } } },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.date': 1 } },
      ]),
    ]);

    return {
      todayCount,
      weekCount,
      totalCount,
      byModule: byModule.reduce((acc, m) => ({ ...acc, [m._id]: m.count }), {}),
      byAction: byAction.reduce((acc, a) => ({ ...acc, [a._id]: a.count }), {}),
      recentActivity: recentActivity.map((r) => ({ date: r._id.date, count: r.count })),
    };
  }
}
