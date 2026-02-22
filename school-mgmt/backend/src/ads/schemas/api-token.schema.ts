import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { AdPlatform } from './ad-account.schema';

export type ApiTokenDocument = HydratedDocument<ApiToken>;

export enum ApiTokenStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
}

@Schema({ timestamps: true })
export class ApiToken {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'AdAccount', required: true })
  adAccountId!: Types.ObjectId;

  @Prop({ type: String, trim: true })
  adAccountName?: string;

  @Prop({ type: String, enum: Object.values(AdPlatform), required: true })
  platform!: string;

  @Prop({ required: true })
  accessToken!: string;

  @Prop({ type: String })
  refreshToken?: string;

  @Prop({ type: Date })
  expiresAt?: Date;

  @Prop({ type: String, enum: Object.values(ApiTokenStatus), default: ApiTokenStatus.ACTIVE })
  status!: string;

  @Prop({ type: Date })
  lastUsedAt?: Date;

  @Prop({ type: String, trim: true })
  label?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  createdById!: Types.ObjectId;
}

export const ApiTokenSchema = SchemaFactory.createForClass(ApiToken);

ApiTokenSchema.index({ adAccountId: 1 });
ApiTokenSchema.index({ platform: 1, status: 1 });
ApiTokenSchema.index({ adAccountId: 1, status: 1, expiresAt: -1, createdAt: -1 });
