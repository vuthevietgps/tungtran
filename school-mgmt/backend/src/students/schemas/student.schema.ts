import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Product } from '../../products/schemas/product.schema';

export type StudentDocument = HydratedDocument<Student>;

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
}

export const StudentSchema = SchemaFactory.createForClass(Student);
