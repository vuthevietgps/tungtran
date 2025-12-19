import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type StudentSequenceDocument = HydratedDocument<StudentSequence>;

@Schema({ collection: 'student_sequences', timestamps: true })
export class StudentSequence {
  @Prop({ required: true, unique: true, trim: true })
  saleCode!: string;

  @Prop({ required: true, default: 0 })
  current!: number;
}

export const StudentSequenceSchema = SchemaFactory.createForClass(StudentSequence);
