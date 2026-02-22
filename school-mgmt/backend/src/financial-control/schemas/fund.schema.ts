import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type FundDocument = HydratedDocument<Fund>;

export enum FundType {
  RESERVE = 'RESERVE',       // Quỹ đặt chỗ / dự phòng
  PETTY_CASH = 'PETTY_CASH', // Quỹ tiền mặt
  MARKETING = 'MARKETING',   // Quỹ marketing
  TRAINING = 'TRAINING',     // Quỹ đào tạo
  BONUS = 'BONUS',           // Quỹ thưởng
  OTHER = 'OTHER',
}

export enum FundStatus {
  ACTIVE = 'ACTIVE',
  FROZEN = 'FROZEN',
  CLOSED = 'CLOSED',
}

@Schema({ timestamps: true })
export class Fund {
  @Prop({ required: true, trim: true, unique: true })
  fundCode!: string; // e.g. "FUND-001"

  @Prop({ required: true, trim: true })
  name!: string; // Tên quỹ

  @Prop({ type: String, enum: Object.values(FundType), required: true })
  fundType!: string;

  @Prop({ required: true, default: 0 })
  currentBalance!: number;

  @Prop({ required: true, default: 0 })
  minimumBalance!: number; // Mức tối thiểu — cảnh báo khi dưới ngưỡng

  @Prop({ required: true, default: 0 })
  targetBalance!: number; // Mức đích

  @Prop({ type: String, enum: Object.values(FundStatus), default: FundStatus.ACTIVE })
  status!: string;

  @Prop({ type: String, trim: true })
  description?: string;

  // Tracking totals
  @Prop({ default: 0 })
  totalDeposited!: number;

  @Prop({ default: 0 })
  totalWithdrawn!: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  createdById?: Types.ObjectId;

  @Prop({ type: String })
  createdByName?: string;
}

export const FundSchema = SchemaFactory.createForClass(Fund);
FundSchema.index({ fundType: 1 });
FundSchema.index({ status: 1 });

