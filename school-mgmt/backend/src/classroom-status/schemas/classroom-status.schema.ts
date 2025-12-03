import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Order } from '../../orders/schemas/order.schema';

export type ClassroomStatusDocument = HydratedDocument<ClassroomStatus>;

@Schema({ timestamps: true })
export class ClassroomStatus {
  @Prop({ type: SchemaTypes.ObjectId, ref: Order.name, required: true })
  orderId!: Types.ObjectId;

  @Prop({ required: true, trim: true, uppercase: true })
  studentCode!: string;

  @Prop({ required: true, trim: true })
  studentName!: string;

  @Prop({ required: true, trim: true, uppercase: true })
  classCode!: string;

  @Prop({ trim: true, default: 'Đang hoạt động' })
  status?: string;

  @Prop({ trim: true })
  paymentStatus?: string;

  @Prop({ type: Boolean, default: false })
  isLocked!: boolean;
}

export const ClassroomStatusSchema = SchemaFactory.createForClass(ClassroomStatus);

// Create unique index on orderId
ClassroomStatusSchema.index({ orderId: 1 }, { unique: true });
// Create index for common queries
ClassroomStatusSchema.index({ studentCode: 1, classCode: 1 });
ClassroomStatusSchema.index({ isLocked: 1 });
