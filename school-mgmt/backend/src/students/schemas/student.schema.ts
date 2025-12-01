import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Product } from '../../products/schemas/product.schema';

export type StudentDocument = HydratedDocument<Student>;

@Schema({ _id: false })
export class PaymentFrame {
  @Prop({ type: Number, min: 1, max: 10, required: true })
  frameIndex!: number; // 1..10

  @Prop({ type: String, required: false, trim: true })
  invoiceCode?: string;

  @Prop({ type: Number, min: 0 })
  sessionsRegistered?: number;

  @Prop({ type: Number, min: 0 })
  pricePerSession?: number;

  @Prop({ type: Number, min: 0 })
  amountCollected?: number;

  @Prop({ type: Number, min: 0 })
  sessionsCollected?: number;

  @Prop({ type: String })
  invoiceImage?: string;

  @Prop({ type: String, enum: ['PENDING', 'CONFIRMED'], default: 'PENDING' })
  confirmStatus?: 'PENDING' | 'CONFIRMED';
}

export const PaymentFrameSchema = SchemaFactory.createForClass(PaymentFrame);

@Schema({ timestamps: true })
export class Student {
  @Prop({ required: true, trim: true, unique: true })
  studentCode!: string;

  @Prop({ required: true, trim: true })
  fullName!: string;

  @Prop({ required: true, min: 3, max: 25 })
  age!: number;

  @Prop({ required: true, trim: true })
  parentName!: string;

  @Prop({ required: true, trim: true })
  parentPhone!: string;

  @Prop({ required: true, trim: true })
  faceImage!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: Product.name })
  productPackage?: Types.ObjectId;
  @Prop({ type: String, enum: ['ONLINE', 'OFFLINE'], required: false })
  studentType?: 'ONLINE' | 'OFFLINE';

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  saleId?: Types.ObjectId;

  @Prop({ type: String, required: false })
  saleName?: string;

  @Prop({ type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' })
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: false })
  approvedBy?: Types.ObjectId;

  @Prop({ type: Date, required: false })
  approvedAt?: Date;

  @Prop({ type: [PaymentFrameSchema], default: [] })
  payments?: PaymentFrame[];
}

export const StudentSchema = SchemaFactory.createForClass(Student);
