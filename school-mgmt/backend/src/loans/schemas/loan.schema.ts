import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type LoanDocument = HydratedDocument<Loan>;

export enum LenderType {
  BANK = 'BANK',
  INDIVIDUAL = 'INDIVIDUAL',
  ORGANIZATION = 'ORGANIZATION',
  OTHER = 'OTHER',
}

export enum LoanType {
  WORKING_CAPITAL = 'WORKING_CAPITAL',
  EQUIPMENT = 'EQUIPMENT',
  RENOVATION = 'RENOVATION',
  EXPANSION = 'EXPANSION',
  OTHER = 'OTHER',
}

export enum InterestType {
  FIXED = 'FIXED',
  FLOATING = 'FLOATING',
}

export enum PaymentFrequency {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  SEMI_ANNUALLY = 'SEMI_ANNUALLY',
  ANNUALLY = 'ANNUALLY',
}

export enum LoanStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  DEFAULTED = 'DEFAULTED',
  RESTRUCTURED = 'RESTRUCTURED',
}

@Schema({ timestamps: true })
export class Loan {
  @Prop({ required: true, trim: true, unique: true })
  loanCode!: string;

  @Prop({ required: true, trim: true })
  lenderName!: string;

  @Prop({ type: String, enum: Object.values(LenderType), required: true })
  lenderType!: string;

  @Prop({ type: String, enum: Object.values(LoanType), required: true })
  loanType!: string;

  @Prop({ required: true, min: 0 })
  principal!: number;

  @Prop({ required: true, min: 0 })
  interestRate!: number;

  @Prop({ type: String, enum: Object.values(InterestType), required: true })
  interestType!: string;

  @Prop({ required: true, min: 1 })
  term!: number;

  @Prop({ type: Date, required: true })
  startDate!: Date;

  @Prop({ type: Date, required: true })
  endDate!: Date;

  @Prop({ type: String, enum: Object.values(PaymentFrequency), required: true })
  paymentFrequency!: string;

  @Prop({ type: String, enum: Object.values(LoanStatus), default: LoanStatus.DRAFT })
  status!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'BankAccount' })
  bankAccountId?: Types.ObjectId;

  @Prop({ default: 0 })
  totalPaid!: number;

  @Prop({ required: true })
  remainingBalance!: number;

  @Prop({ type: String, trim: true })
  collateral?: string;

  @Prop({ type: String, trim: true })
  notes?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  createdById!: Types.ObjectId;

  @Prop({ type: String, required: true })
  createdByName!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  approvedById?: Types.ObjectId;

  @Prop({ type: String })
  approvedByName?: string;

  @Prop({ type: Date })
  approvedAt?: Date;
}

export const LoanSchema = SchemaFactory.createForClass(Loan);
LoanSchema.index({ status: 1 });
LoanSchema.index({ lenderName: 1 });
LoanSchema.index({ startDate: -1 });
LoanSchema.index({ endDate: 1 });

