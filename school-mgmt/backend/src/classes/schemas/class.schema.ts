import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Student } from '../../students/schemas/student.schema';

export type ClassDocument = HydratedDocument<Classroom>;
export type ClassroomDocument = HydratedDocument<Classroom>;

@Schema({ timestamps: true })
export class Classroom {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true, unique: true, uppercase: true })
  code!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: true })
  teacher!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: true })
  sale!: Types.ObjectId;

  @Prop({ type: [SchemaTypes.ObjectId], ref: Student.name, default: [] })
  students!: Types.ObjectId[];

  @Prop({ type: Number, min: 0, default: 0 })
  revenuePerStudent!: number; // Doanh thu mỗi học sinh (VNĐ)

  @Prop({ type: Number, min: 0, default: 0 })
  teacherSalaryCost!: number; // Chi phí lương giáo viên mỗi học sinh (VNĐ)
}

export const ClassroomSchema = SchemaFactory.createForClass(Classroom);
