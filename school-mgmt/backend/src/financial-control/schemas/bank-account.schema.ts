import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type BankAccountDocument = HydratedDocument<BankAccount>;

export enum BankAccountStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  CLOSED = 'CLOSED',
}

@Schema({ timestamps: true })
export class BankAccount {
  @Prop({ required: true, trim: true, unique: true })
  accountCode!: string; // e.g. "BA-001"

  @Prop({ required: true, trim: true })
  bankName!: string; // Tên ngân hàng

  @Prop({ required: true, trim: true })
  accountNumber!: string; // Số tài khoản

  @Prop({ type: String, trim: true })
  accountHolder?: string; // Chủ tài khoản

  @Prop({ type: String, trim: true })
  branch?: string; // Chi nhánh

  @Prop({ required: true, default: 0 })
  currentBalance!: number; // Số dư hiện tại

  @Prop({ required: true, default: 0 })
  openingBalance!: number; // Số dư đầu kỳ

  @Prop({ type: String, enum: Object.values(BankAccountStatus), default: BankAccountStatus.ACTIVE })
  status!: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ type: Boolean, default: false })
  isPrimary?: boolean; // Tài khoản chính

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  createdById?: Types.ObjectId;

  @Prop({ type: String })
  createdByName?: string;
}

export const BankAccountSchema = SchemaFactory.createForClass(BankAccount);
BankAccountSchema.index({ status: 1 });
BankAccountSchema.index({ bankName: 1 });

