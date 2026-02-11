import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification, NotificationDocument, NotificationType, NotificationPriority,
} from './schemas/notification.schema';
import { Role } from '../common/interfaces/role.enum';
import { User, UserDocument } from '../users/schemas/user.schema';

export interface CreateNotificationParams {
  recipientId: string;
  recipientRole?: string;
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message: string;
  link?: string;
  targetId?: string;
  targetModule?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private notificationModel: Model<NotificationDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /** Create a single notification */
  async create(params: CreateNotificationParams): Promise<Notification> {
    try {
      const entry = new this.notificationModel({
        recipientId: new Types.ObjectId(params.recipientId),
        recipientRole: params.recipientRole,
        type: params.type,
        priority: params.priority || NotificationPriority.MEDIUM,
        title: params.title,
        message: params.message,
        link: params.link,
        targetId: params.targetId,
        targetModule: params.targetModule,
      });
      return await entry.save();
    } catch (err) {
      console.error('Notification create error:', err);
      return params as any;
    }
  }

  /** Notify all users with a specific role */
  async notifyByRole(
    role: Role,
    params: Omit<CreateNotificationParams, 'recipientId' | 'recipientRole'>,
  ): Promise<void> {
    try {
      const users = await this.userModel.find({ role, isLocked: { $ne: true } }).select('_id').lean();
      const docs = users.map((u) => ({
        recipientId: u._id,
        recipientRole: role,
        ...params,
      }));
      if (docs.length > 0) {
        await this.notificationModel.insertMany(docs);
      }
    } catch (err) {
      console.error('Notify by role error:', err);
    }
  }

  /** Get notifications for a user */
  async getMyNotifications(userId: string, query: { page?: number; limit?: number; unreadOnly?: boolean }) {
    const filter: any = { recipientId: new Types.ObjectId(userId) };
    if (query.unreadOnly) filter.isRead = false;

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total, unreadCount] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.notificationModel.countDocuments(filter),
      this.notificationModel.countDocuments({
        recipientId: new Types.ObjectId(userId),
        isRead: false,
      }),
    ]);

    return { data, total, unreadCount, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** Get unread count */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      recipientId: new Types.ObjectId(userId),
      isRead: false,
    });
  }

  /** Mark one notification as read */
  async markAsRead(notificationId: string, userId: string) {
    return this.notificationModel.findOneAndUpdate(
      { _id: new Types.ObjectId(notificationId), recipientId: new Types.ObjectId(userId) },
      { isRead: true, readAt: new Date() },
      { new: true },
    );
  }

  /** Mark all as read */
  async markAllAsRead(userId: string) {
    const result = await this.notificationModel.updateMany(
      { recipientId: new Types.ObjectId(userId), isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return { modifiedCount: result.modifiedCount };
  }

  /** Delete old notifications (>30 days, read) */
  async cleanup(): Promise<number> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await this.notificationModel.deleteMany({
      isRead: true,
      createdAt: { $lt: cutoff },
    });
    return result.deletedCount;
  }
}
