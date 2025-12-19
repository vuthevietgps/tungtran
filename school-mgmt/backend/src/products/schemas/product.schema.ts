import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProductDocument = HydratedDocument<Product>;

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, enum: ['ONLINE', 'OFFLINE'], default: 'ONLINE' })
  productType!: 'ONLINE' | 'OFFLINE';

  @Prop({ trim: true })
  teacherName?: string;

  @Prop({ trim: true })
  content?: string;

  @Prop({ trim: true })
  duration?: string;

  @Prop({ trim: true })
  sessionCount?: string;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
