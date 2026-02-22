import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type BankTransactionDocument = HydratedDocument<BankTransaction>;

export enum BankTransactionType {
  DEPOSIT = 'DEPOSIT',         // Nạp vào
  WITHDRAWAL = 'WITHDRAWAL',   // Rút ra
  TRANSFER_IN = 'TRANSFER_IN', // Chuyển khoản đến
  TRANSFER_OUT = 'TRANSFER_OUT', // Chuyển khoản đi
  INTEREST = 'INTEREST',       // Lãi suất
  FEE = 'FEE',                 // Phí dịch vụ
  ADJUSTMENT = 'ADJUSTMENT',   // Điều chỉnh
}

export enum BankTransactionCategory {
  TUITION_INCOME = 'TUITION_INCOME',     // Thu học phí
  PAYROLL = 'PAYROLL',                    // Chi lương
  EXPENSE = 'EXPENSE',                    // Chi phí vận hành
  RESERVE_FUND = 'RESERVE_FUND',         // Quỹ dự phòng
  PETTY_CASH = 'PETTY_CASH',             // Quỹ tiền mặt
  COMMISSION = 'COMMISSION',              // Hoa hồng
  REFUND = 'REFUND',                      // Hoàn tiền
  LOAN_DISBURSEMENT = 'LOAN_DISBURSEMENT', // Giải ngân vốn vay
  LOAN_REPAYMENT = 'LOAN_REPAYMENT',       // Trả nợ vay
  OTHER = 'OTHER',
}

@Schema({ timestamps: true })
export class BankTransaction {
  @Prop({ required: true, trim: true, unique: true })
  transactionCode!: string; // e.g. "BT-00001"

  @Prop({ type: SchemaTypes.ObjectId, ref: 'BankAccount', required: true })
  bankAccountId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(BankTransactionType), required: true })
  type!: string;

  @Prop({ type: String, enum: Object.values(BankTransactionCategory), default: BankTransactionCategory.OTHER })
  category!: string;

  @Prop({ required: true })
  amount!: number; // Luôn dương

  @Prop({ required: true })
  balanceBefore!: number;

  @Prop({ required: true })
  balanceAfter!: number;

  @Prop({ type: Date, required: true })
  transactionDate!: Date;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ type: String, trim: true })
  reference?: string; // Mã tham chiếu (invoice, payroll, expense code)

  @Prop({ type: SchemaTypes.ObjectId })
  referenceId?: Types.ObjectId; // ID liên kết

  @Prop({ type: String })
  referenceType?: string; // 'INVOICE', 'PAYROLL', 'EXPENSE', etc.

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  recordedById!: Types.ObjectId;

  @Prop({ type: String, required: true })
  recordedByName!: string;

  @Prop({ type: Boolean, default: false })
  isReconciled?: boolean;

  @Prop({ type: Date })
  reconciledAt?: Date;

  @Prop({ type: String })
  reconciledByName?: string;
}

export const BankTransactionSchema = SchemaFactory.createForClass(BankTransaction);
BankTransactionSchema.index({ bankAccountId: 1, transactionDate: -1 });
BankTransactionSchema.index({ type: 1 });
BankTransactionSchema.index({ category: 1 });
BankTransactionSchema.index({ referenceId: 1 });
BankTransactionSchema.index({ isReconciled: 1 });

