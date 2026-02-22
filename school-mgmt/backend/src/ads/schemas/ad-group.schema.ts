import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { AdPlatform } from './ad-account.schema';

export type AdGroupDocument = HydratedDocument<AdGroup>;

export enum AdGroupStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ARCHIVED = 'ARCHIVED',
}

@Schema({ timestamps: true })
export class AdGroup {
  @Prop({ required: true, trim: true, unique: true })
  groupCode!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'AdAccount', required: true })
  adAccountId!: Types.ObjectId;

  @Prop({ type: String, trim: true })
  adAccountName?: string;

  @Prop({ type: String, enum: Object.values(AdPlatform), required: true })
  platform!: string;

  @Prop({ required: true, trim: true })
  platformCampaignId!: string;

  @Prop({ type: String, enum: Object.values(AdGroupStatus), default: AdGroupStatus.ACTIVE })
  status!: string;

  @Prop({ type: Number, min: 0, default: 0 })
  dailyBudget?: number;

  @Prop({ type: Date })
  startDate?: Date;

  @Prop({ type: Date })
  endDate?: Date;

  @Prop({ type: String, trim: true })
  targetAudience?: string;

  @Prop({ type: String, trim: true })
  notes?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  createdById!: Types.ObjectId;

  @Prop({ type: String, trim: true })
  createdByName?: string;
}

export const AdGroupSchema = SchemaFactory.createForClass(AdGroup);
AdGroupSchema.index({ adAccountId: 1 });
AdGroupSchema.index({ adAccountId: 1, platformCampaignId: 1 }, { unique: true });
AdGroupSchema.index({ platform: 1, status: 1 });
AdGroupSchema.index({ createdAt: -1 });

