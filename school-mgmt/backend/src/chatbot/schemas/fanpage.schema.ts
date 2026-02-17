import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type FanpageDocument = HydratedDocument<Fanpage>;

export enum FanpagePlatform {
  FACEBOOK = 'FACEBOOK',
  TIKTOK = 'TIKTOK',
}

export enum FanpageStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

@Schema({ timestamps: true })
export class Fanpage {
  @Prop({ required: true, trim: true, unique: true })
  fanpageCode!: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: String, enum: Object.values(FanpagePlatform), required: true })
  platform!: string;

  @Prop({ required: true, trim: true })
  pageId!: string;

  @Prop({ type: String, trim: true })
  pageAccessToken?: string;

  @Prop({ type: String, trim: true })
  description?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'AdAccount' })
  adAccountId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  adAccountName?: string;

  @Prop({ type: String, trim: true })
  webhookVerifyToken?: string;

  @Prop({ type: String, trim: true })
  appSecret?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'OpenAIToken' })
  openaiTokenId?: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(FanpageStatus), default: FanpageStatus.ACTIVE })
  status!: string;

  @Prop({ type: Boolean, default: true })
  aiAutoReplyEnabled!: boolean;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  createdById!: Types.ObjectId;

  @Prop({ type: String, trim: true })
  createdByName?: string;
}

export const FanpageSchema = SchemaFactory.createForClass(Fanpage);

FanpageSchema.index({ fanpageCode: 1 }, { unique: true });
FanpageSchema.index({ platform: 1, pageId: 1 }, { unique: true });
FanpageSchema.index({ status: 1 });
FanpageSchema.index({ createdAt: -1 });
