import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type InvoiceSequenceDocument = HydratedDocument<InvoiceSequence>;

@Schema({ collection: 'invoice_sequences', timestamps: true })
export class InvoiceSequence {
  @Prop({ required: true, unique: true, trim: true })
  saleCode!: string;

  @Prop({ required: true, default: 0 })
  current!: number;
}

export const InvoiceSequenceSchema = SchemaFactory.createForClass(InvoiceSequence);
