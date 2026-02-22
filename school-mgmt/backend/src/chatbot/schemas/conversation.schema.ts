import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type ConversationDocument = HydratedDocument<Conversation>;

export enum ConversationStatus {
  AI_HANDLING = 'AI_HANDLING',
  HUMAN_HANDLING = 'HUMAN_HANDLING',
  CLOSED = 'CLOSED',
}

@Schema({ timestamps: true })
export class Conversation {
  @Prop({ required: true, trim: true, unique: true })
  conversationCode!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Fanpage', required: true })
  fanpageId!: Types.ObjectId;

  @Prop({ type: String, trim: true })
  fanpageName?: string;

  @Prop({ type: String, required: true })
  platform!: string;

  @Prop({ required: true, trim: true })
  platformUserId!: string;

  @Prop({ type: String, trim: true })
  platformConversationId?: string;

  @Prop({ type: String, trim: true })
  customerName?: string;

  @Prop({ type: String, trim: true })
  customerPhone?: string;

  @Prop({ type: String, trim: true })
  customerEmail?: string;

  @Prop({ type: String, enum: Object.values(ConversationStatus), default: ConversationStatus.AI_HANDLING })
  status!: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  assignedAgentId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  assignedAgentName?: string;

  @Prop({ type: Date })
  lastMessageAt?: Date;

  @Prop({ type: Number, default: 0 })
  messageCount?: number;

  @Prop({ type: String, trim: true })
  adRefParam?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'AdGroup' })
  adGroupId?: Types.ObjectId;

  @Prop({ type: String, trim: true })
  adGroupName?: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Lead' })
  leadId?: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Order' })
  orderId?: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop({ type: String, trim: true })
  notes?: string;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
ConversationSchema.index({ fanpageId: 1, platformUserId: 1 }, { unique: true });
ConversationSchema.index({ status: 1 });
ConversationSchema.index({ lastMessageAt: -1 });
ConversationSchema.index({ assignedAgentId: 1 });
ConversationSchema.index({ adGroupId: 1 });
ConversationSchema.index({ platform: 1 });

