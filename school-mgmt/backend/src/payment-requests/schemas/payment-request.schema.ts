import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Order } from '../../orders/schemas/order.schema';

export type PaymentRequestDocument = HydratedDocument<PaymentRequest>;

export interface SessionInfo {
  sessionIndex: number;
  date?: string;
  attendedAt?: string;
  imageUrl?: string;
}

@Schema({ timestamps: true })
export class PaymentRequest {
  @Prop({ type: SchemaTypes.ObjectId, ref: Order.name, required: true })
  orderId!: Types.ObjectId;

  @Prop({ required: true, trim: true, uppercase: true })
  studentCode!: string;

  @Prop({ required: true, trim: true })
  studentName!: string;

  @Prop({ required: true, trim: true, uppercase: true })
  classCode!: string;

  @Prop({ type: Number, min: 0 })
  teacherSalary?: number;

  @Prop({ type: [Object], default: [] })
  sessions!: SessionInfo[];

  @Prop({ type: Number, min: 0, default: 0 })
  totalAttendedSessions!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  teacherEarnedSalary!: number;

  @Prop({ trim: true })
  paymentStatus?: string;

  @Prop({ trim: true })
  paymentInvoiceCode?: string;

  @Prop({ trim: true })
  paymentProofImage?: string;
}

export const PaymentRequestSchema = SchemaFactory.createForClass(PaymentRequest);

// Create unique index on orderId
PaymentRequestSchema.index({ orderId: 1 }, { unique: true });
// Create index for common queries
PaymentRequestSchema.index({ studentCode: 1, classCode: 1 });
PaymentRequestSchema.index({ paymentStatus: 1 });
