import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type LoanPaymentDocument = HydratedDocument<LoanPayment>;

export enum LoanPaymentStatus {
  SCHEDULED = 'SCHEDULED',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  PARTIAL = 'PARTIAL',
}

@Schema({ timestamps: true })
export class LoanPayment {
  @Prop({ required: true, trim: true, unique: true })
  paymentCode!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Loan', required: true })
  loanId!: Types.ObjectId;

  @Prop({ required: true })
  paymentNumber!: number;

  @Prop({ type: Date, required: true })
  dueDate!: Date;

  @Prop({ type: Date })
  paidDate?: Date;

  @Prop({ required: true, min: 0 })
  principalAmount!: number;

  @Prop({ required: true, min: 0 })
  interestAmount!: number;

  @Prop({ required: true, min: 0 })
  totalAmount!: number;

  @Prop({ type: String, enum: Object.values(LoanPaymentStatus), default: LoanPaymentStatus.SCHEDULED })
  status!: string;

  @Prop({ type: String })
  paymentMethod?: string;

  @Prop({ type: String, trim: true })
  reference?: string;

  @Prop({ type: String, trim: true })
  notes?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  paidById?: Types.ObjectId;

  @Prop({ type: String })
  paidByName?: string;
}

export const LoanPaymentSchema = SchemaFactory.createForClass(LoanPayment);

LoanPaymentSchema.index({ paymentCode: 1 }, { unique: true });
LoanPaymentSchema.index({ loanId: 1, paymentNumber: 1 });
LoanPaymentSchema.index({ dueDate: 1 });
LoanPaymentSchema.index({ status: 1 });
