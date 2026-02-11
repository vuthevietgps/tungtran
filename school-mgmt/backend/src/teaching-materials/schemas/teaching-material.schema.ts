import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TeachingMaterialDocument = TeachingMaterial & Document;

@Schema({ timestamps: true })
export class TeachingMaterial {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  teacherId!: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  title!: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ type: String, trim: true, index: true })
  subject?: string;

  @Prop({ type: String, trim: true, index: true })
  grade?: string;

  @Prop({ type: Types.ObjectId, ref: 'Classroom' })
  classId?: Types.ObjectId;

  @Prop({ type: String, required: true })
  fileUrl!: string;

  @Prop({ type: String, required: true })
  fileType!: string; // mime type

  @Prop({ type: Number, required: true })
  fileSize!: number; // bytes

  @Prop({ type: String, required: true })
  originalName!: string;

  @Prop({ type: [String], default: [], index: true })
  tags!: string[];

  @Prop({ type: Boolean, default: false })
  isShared!: boolean; // Chia sẻ với GV khác

  @Prop({ type: Number, default: 0 })
  downloadCount!: number;

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const TeachingMaterialSchema = SchemaFactory.createForClass(TeachingMaterial);

// Compound index for teacher + subject queries
TeachingMaterialSchema.index({ teacherId: 1, subject: 1, grade: 1 });
