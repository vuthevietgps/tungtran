import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Student } from '../../students/schemas/student.schema';
import { User } from '../../users/schemas/user.schema';

export type InvoiceDocument = HydratedDocument<Invoice>;

@Schema({ timestamps: true })
export class Invoice {
  @Prop({ required: true, trim: true, unique: true })
  invoiceNumber!: string;

  @Prop({ required: true, trim: true, default: 'UNKNOWN' })
  saleCode!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: Student.name, required: true })
  studentId!: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  amount!: number;

  @Prop({ required: true })
  paymentDate!: Date;

  @Prop({ required: true, trim: true })
  receiptImage!: string; // Ảnh chứng từ

  @Prop({ type: String, trim: true })
  description?: string; // Mô tả hóa đơn

  @Prop({ type: String, enum: ['PAID', 'PENDING', 'CANCELLED'], default: 'PAID' })
  status!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: true })
  createdBy!: Types.ObjectId;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);