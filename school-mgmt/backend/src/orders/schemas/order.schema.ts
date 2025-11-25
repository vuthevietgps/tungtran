import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Student } from '../../students/schemas/student.schema';
import { User } from '../../users/schemas/user.schema';
import { Classroom } from '../../classes/schemas/class.schema';

export type OrderDocument = HydratedDocument<Order>;

@Schema({ timestamps: true })
export class Order {
  @Prop({ type: SchemaTypes.ObjectId, ref: Student.name })
  studentId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  studentName!: string;

  @Prop({ required: true, trim: true, uppercase: true })
  studentCode!: string;

  @Prop({ trim: true })
  level?: string;

  @Prop({ required: true, trim: true })
  parentName!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name })
  teacherId?: Types.ObjectId;

  @Prop({ trim: true })
  teacherName?: string;

  @Prop({ trim: true, lowercase: true })
  teacherEmail?: string;

  @Prop({ trim: true })
  teacherCode?: string;

  @Prop({ type: Number, min: 0 })
  teacherSalary?: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name })
  saleId?: Types.ObjectId;

  @Prop({ trim: true })
  saleName?: string;

  @Prop({ trim: true, lowercase: true })
  saleEmail?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: Classroom.name })
  classId?: Types.ObjectId;

  @Prop({ trim: true, uppercase: true })
  classCode?: string;

  @Prop({ trim: true })
  invoiceNumber?: string;

  @Prop({ type: Number, min: 0 })
  sessionsByInvoice?: number;

  @Prop({ trim: true })
  dataStatus?: string;

  @Prop({ trim: true })
  trialOrGift?: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);
