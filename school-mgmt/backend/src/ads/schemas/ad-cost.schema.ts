import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { AdPlatform } from './ad-account.schema';

export type AdCostDocument = HydratedDocument<AdCost>;

export enum AdCostSource {
  SYNCED = 'SYNCED',
  MANUAL = 'MANUAL',
  ESTIMATED = 'ESTIMATED',
}

@Schema({ timestamps: true })
export class AdCost {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'AdGroup', required: true })
  adGroupId!: Types.ObjectId;

  @Prop({ type: String, trim: true })
  adGroupName?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'AdAccount', required: true })
  adAccountId!: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(AdPlatform), required: true })
  platform!: string;

  @Prop({ type: Date, required: true })
  date!: Date;

  @Prop({ type: Number, min: 0, required: true })
  spend!: number;

  @Prop({ type: Number, min: 0, default: 0 })
  impressions?: number;

  @Prop({ type: Number, min: 0, default: 0 })
  clicks?: number;

  @Prop({ type: Number, min: 0, default: 0 })
  conversions?: number;

  @Prop({ type: String, enum: Object.values(AdCostSource), default: AdCostSource.SYNCED })
  source!: string;

  @Prop({ type: Date })
  syncedAt?: Date;
}

export const AdCostSchema = SchemaFactory.createForClass(AdCost);

AdCostSchema.index({ adGroupId: 1, date: -1 }, { unique: true });
AdCostSchema.index({ adAccountId: 1, date: -1 });
AdCostSchema.index({ date: -1 });
AdCostSchema.index({ platform: 1 });
