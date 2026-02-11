import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

export enum NotificationType {
  PAYROLL_PENDING = 'PAYROLL_PENDING',
  PAYROLL_APPROVED = 'PAYROLL_APPROVED',
  PAYROLL_REJECTED = 'PAYROLL_REJECTED',
  INVOICE_PENDING = 'INVOICE_PENDING',
  INVOICE_APPROVED = 'INVOICE_APPROVED',
  TOPUP_PENDING = 'TOPUP_PENDING',
  TOPUP_APPROVED = 'TOPUP_APPROVED',
  TOPUP_REJECTED = 'TOPUP_REJECTED',
  TEACHER_PENDING = 'TEACHER_PENDING',
  TEACHER_APPROVED = 'TEACHER_APPROVED',
  TICKET_NEW = 'TICKET_NEW',
  TICKET_OVERDUE = 'TICKET_OVERDUE',
  TICKET_RESOLVED = 'TICKET_RESOLVED',
  SESSION_CONFLICT = 'SESSION_CONFLICT',
  WALLET_LOW_BALANCE = 'WALLET_LOW_BALANCE',
  ORDER_APPROVED = 'ORDER_APPROVED',
  ENROLLMENT_COMPLETED = 'ENROLLMENT_COMPLETED',
  SYSTEM = 'SYSTEM',
}

export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

@Schema({ timestamps: true })
export class Notification {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  recipientId!: Types.ObjectId;

  @Prop({ type: String, trim: true })
  recipientRole?: string;

  @Prop({ type: String, enum: NotificationType, required: true })
  type!: NotificationType;

  @Prop({ type: String, enum: NotificationPriority, default: NotificationPriority.MEDIUM })
  priority!: NotificationPriority;

  @Prop({ type: String, required: true, trim: true })
  title!: string;

  @Prop({ type: String, required: true, trim: true })
  message!: string;

  @Prop({ type: String, trim: true })
  link?: string;

  @Prop({ type: String, trim: true })
  targetId?: string;

  @Prop({ type: String, trim: true })
  targetModule?: string;

  @Prop({ type: Boolean, default: false })
  isRead!: boolean;

  @Prop({ type: Date })
  readAt?: Date;

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, createdAt: -1 });
NotificationSchema.index({ type: 1, createdAt: -1 });
