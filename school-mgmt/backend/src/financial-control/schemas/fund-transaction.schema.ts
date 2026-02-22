import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type FundTransactionDocument = HydratedDocument<FundTransaction>;

export enum FundTransactionType {
  DEPOSIT = 'DEPOSIT',       // Nạp vào quỹ
  WITHDRAW = 'WITHDRAW',     // Rút từ quỹ
  ADJUSTMENT = 'ADJUSTMENT', // Điều chỉnh
}

@Schema({ timestamps: true })
export class FundTransaction {
  @Prop({ required: true, trim: true, unique: true })
  transactionCode!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Fund', required: true })
  fundId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(FundTransactionType), required: true })
  type!: string;

  @Prop({ required: true })
  amount!: number;

  @Prop({ required: true })
  balanceBefore!: number;

  @Prop({ required: true })
  balanceAfter!: number;

  @Prop({ type: Date, required: true })
  transactionDate!: Date;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ type: String, trim: true })
  reference?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  performedById!: Types.ObjectId;

  @Prop({ type: String, required: true })
  performedByName!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  approvedById?: Types.ObjectId;

  @Prop({ type: String })
  approvedByName?: string;
}

export const FundTransactionSchema = SchemaFactory.createForClass(FundTransaction);
FundTransactionSchema.index({ fundId: 1, transactionDate: -1 });
FundTransactionSchema.index({ type: 1 });

