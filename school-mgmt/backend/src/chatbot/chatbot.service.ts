import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FilterQuery } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

import { Fanpage, FanpageDocument, FanpagePlatform, FanpageSyncSource } from './schemas/fanpage.schema';
import { OpenAIToken, OpenAITokenDocument, OpenAITokenStatus } from './schemas/openai-token.schema';
import { Conversation, ConversationDocument, ConversationStatus } from './schemas/conversation.schema';
import { Message, MessageDocument, SenderType, MessageStatus } from './schemas/message.schema';
import { AdGroup, AdGroupDocument } from '../ads/schemas/ad-group.schema';
import { Lead, LeadDocument, LeadStatus } from '../leads/schemas/lead.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';

import { CreateFanpageDto } from './dto/create-fanpage.dto';
import { UpdateFanpageDto } from './dto/update-fanpage.dto';
import { QueryFanpageDto } from './dto/query-fanpage.dto';
import { CreateOpenAITokenDto } from './dto/create-openai-token.dto';
import { UpdateOpenAITokenDto } from './dto/update-openai-token.dto';
import { QueryConversationDto } from './dto/query-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { QueryMessageDto } from './dto/query-message.dto';
import { CreateLeadFromConvDto } from './dto/create-lead-from-conv.dto';
import { CreateOrderFromConvDto } from './dto/create-order-from-conv.dto';

import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditAction } from '../audit-log/schemas/audit-log.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@Injectable()
export class ChatbotService {
  private readonly logger = new Logger(ChatbotService.name);
  private encryptionKey: Buffer | null = null;

  constructor(
    @InjectModel(Fanpage.name) private fanpageModel: Model<FanpageDocument>,
    @InjectModel(OpenAIToken.name) private openaiTokenModel: Model<OpenAITokenDocument>,
    @InjectModel(Conversation.name) private conversationModel: Model<ConversationDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(AdGroup.name) private adGroupModel: Model<AdGroupDocument>,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private configService: ConfigService,
    private auditLogService: AuditLogService,
  ) {
    const key = this.configService.get<string>('TOKEN_ENCRYPTION_KEY');
    if (key) {
      this.encryptionKey = Buffer.from(key, 'hex');
    }
  }

  // ─── Encryption helpers ─────────────────────────────────────

  private encrypt(plainText: string): string {
    if (!this.encryptionKey) return plainText;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    let encrypted = cipher.update(plainText, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  private decrypt(cipherText: string): string {
    if (!this.encryptionKey) return cipherText;
    const parts = cipherText.split(':');
    if (parts.length !== 3) return cipherText;
    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private maskToken(token: string): string {
    if (token.length <= 8) return '****';
    return '****' + token.slice(-6);
  }

  private mapFanpageForResponse(fp: any) {
    const openAIToken = fp?.openaiTokenId && typeof fp.openaiTokenId === 'object'
      ? fp.openaiTokenId
      : null;

    return {
      ...fp,
      openaiTokenId: openAIToken?._id ? openAIToken._id.toString() : fp.openaiTokenId,
      openaiTokenLabel: openAIToken?.label,
      openaiModel: openAIToken?.model,
      pageAccessToken: fp.pageAccessToken ? this.maskToken(fp.pageAccessToken) : undefined,
      appSecret: fp.appSecret ? this.maskToken(fp.appSecret) : undefined,
    };
  }

  // ─── Fanpage CRUD ───────────────────────────────────────────

  private async generateFanpageCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `FP-${year}-`;
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.fanpageModel.countDocuments({ fanpageCode: { $regex: `^${prefix}` } });
      const code = `${prefix}${String(count + 1 + attempt).padStart(4, '0')}`;
      const exists = await this.fanpageModel.exists({ fanpageCode: code });
      if (!exists) return code;
    }
    return `${prefix}${Date.now()}`;
  }

  async createFanpage(dto: CreateFanpageDto, user: JwtPayload) {
    const fanpageCode = await this.generateFanpageCode();

    let adAccountName: string | undefined;
    if (dto.adAccountId) {
      const acc = await this.adGroupModel.db.model('AdAccount').findById(dto.adAccountId).lean() as any;
      adAccountName = acc?.name;
    }

    const data: any = {
      ...dto,
      fanpageCode,
      adAccountName,
      createdById: user.sub,
      createdByName: user.fullName,
    };

    if (dto.pageAccessToken) data.pageAccessToken = this.encrypt(dto.pageAccessToken);
    if (dto.appSecret) data.appSecret = this.encrypt(dto.appSecret);

    const doc = new this.fanpageModel(data);
    const saved = await doc.save();

    await this.auditLogService.log({
      userId: user.sub,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.CREATE,
      module: 'CHATBOT' as any,
      targetId: saved._id?.toString(),
      targetName: saved.fanpageCode,
      description: `Tạo fanpage: ${saved.name} (${saved.platform})`,
    });

    return saved;
  }

  async findAllFanpages(query: QueryFanpageDto) {
    const filter: FilterQuery<FanpageDocument> = {};
    if (query.platform) filter.platform = query.platform;
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { fanpageCode: { $regex: query.search, $options: 'i' } },
        { pageId: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;
    const total = await this.fanpageModel.countDocuments(filter);
    const data = await this.fanpageModel.find(filter)
      .populate({ path: 'openaiTokenId', select: 'label model' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const masked = data.map((fp) => this.mapFanpageForResponse(fp));

    return { data: masked, total, page, limit };
  }

  async findOneFanpage(id: string) {
    const fp = await this.fanpageModel.findById(id)
      .populate({ path: 'openaiTokenId', select: 'label model' })
      .lean();
    if (!fp) throw new NotFoundException('Fanpage không tồn tại');
    return this.mapFanpageForResponse(fp);
  }

  async updateFanpage(id: string, dto: UpdateFanpageDto) {
    const current = await this.fanpageModel.findById(id).lean();
    if (!current) throw new NotFoundException('Fanpage khÃ´ng tá»“n táº¡i');

    const isSyncedFacebookFanpage = current.syncSource === FanpageSyncSource.FACEBOOK_BM
      && current.platform === FanpagePlatform.FACEBOOK;

    const update: any = {};
    const unset: Record<string, 1> = {};

    if (!isSyncedFacebookFanpage && dto.name !== undefined) {
      const name = dto.name.trim();
      if (name) update.name = name;
    }

    if (!isSyncedFacebookFanpage && dto.pageId !== undefined) {
      const pageId = dto.pageId.trim();
      if (pageId) update.pageId = pageId;
    }

    if (!isSyncedFacebookFanpage && dto.pageAccessToken !== undefined) {
      const pageAccessToken = dto.pageAccessToken.trim();
      if (pageAccessToken) update.pageAccessToken = this.encrypt(pageAccessToken);
      else unset.pageAccessToken = 1;
    }

    if (dto.description !== undefined) {
      const description = dto.description.trim();
      if (description) update.description = description;
      else unset.description = 1;
    }

    if (dto.adAccountId !== undefined) {
      const adAccountId = dto.adAccountId.trim();
      if (adAccountId) {
        update.adAccountId = adAccountId;
        const acc = await this.adGroupModel.db.model('AdAccount').findById(adAccountId).lean() as any;
        update.adAccountName = acc?.name;
      } else {
        unset.adAccountId = 1;
        unset.adAccountName = 1;
      }
    }

    if (dto.webhookVerifyToken !== undefined) {
      const webhookVerifyToken = dto.webhookVerifyToken.trim();
      if (webhookVerifyToken) update.webhookVerifyToken = webhookVerifyToken;
      else unset.webhookVerifyToken = 1;
    }

    if (dto.appSecret !== undefined) {
      const appSecret = dto.appSecret.trim();
      if (appSecret) update.appSecret = this.encrypt(appSecret);
      else unset.appSecret = 1;
    }

    if (dto.openaiTokenId !== undefined) {
      const openaiTokenId = dto.openaiTokenId.trim();
      if (openaiTokenId) update.openaiTokenId = openaiTokenId;
      else unset.openaiTokenId = 1;
    }

    if (dto.aiAutoReplyEnabled !== undefined) {
      update.aiAutoReplyEnabled = dto.aiAutoReplyEnabled;
    }

    if (dto.status !== undefined) {
      update.status = dto.status;
    }

    const updateDoc: any = {};
    if (Object.keys(update).length) updateDoc.$set = update;
    if (Object.keys(unset).length) updateDoc.$unset = unset;

    const doc = await this.fanpageModel.findByIdAndUpdate(id, updateDoc, { new: true });
    if (!doc) throw new NotFoundException('Fanpage không tồn tại');
    return doc;
  }

  async deleteFanpage(id: string) {
    const doc = await this.fanpageModel.findByIdAndDelete(id);
    if (!doc) throw new NotFoundException('Fanpage không tồn tại');
  }

  // ─── OpenAI Token CRUD ──────────────────────────────────────

  async createOpenAIToken(dto: CreateOpenAITokenDto, user: JwtPayload) {
    const data: any = {
      ...dto,
      apiKey: this.encrypt(dto.apiKey),
      createdById: user.sub,
    };

    const doc = new this.openaiTokenModel(data);
    const saved = await doc.save();

    await this.auditLogService.log({
      userId: user.sub,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.CREATE,
      module: 'CHATBOT' as any,
      targetId: saved._id?.toString(),
      targetName: saved.label,
      description: `Tạo OpenAI token: ${saved.label}`,
    });

    return { ...saved.toObject(), apiKey: this.maskToken(saved.apiKey) };
  }

  async findAllOpenAITokens() {
    const tokens = await this.openaiTokenModel.find().sort({ createdAt: -1 }).lean();
    return tokens.map(t => ({
      ...t,
      apiKey: this.maskToken(t.apiKey),
    }));
  }

  async updateOpenAIToken(id: string, dto: UpdateOpenAITokenDto) {
    const update: any = { ...dto };
    if (dto.apiKey) update.apiKey = this.encrypt(dto.apiKey);

    const doc = await this.openaiTokenModel.findByIdAndUpdate(id, update, { new: true });
    if (!doc) throw new NotFoundException('OpenAI token không tồn tại');
    return { ...doc.toObject(), apiKey: this.maskToken(doc.apiKey) };
  }

  async deleteOpenAIToken(id: string) {
    const doc = await this.openaiTokenModel.findByIdAndDelete(id);
    if (!doc) throw new NotFoundException('OpenAI token không tồn tại');
  }

  async getDecryptedOpenAIKey(tokenId: string | Types.ObjectId): Promise<{
    key: string; model: string; temperature: number; maxTokens: number; systemPromptPrefix?: string;
  } | null> {
    const token = await this.openaiTokenModel.findById(tokenId);
    if (!token || token.status !== OpenAITokenStatus.ACTIVE) return null;

    await this.openaiTokenModel.updateOne({ _id: token._id }, { lastUsedAt: new Date() });

    return {
      key: this.decrypt(token.apiKey),
      model: token.model,
      temperature: token.temperature ?? 0.7,
      maxTokens: token.maxTokens ?? 2000,
      systemPromptPrefix: token.systemPromptPrefix,
    };
  }

  // ─── Conversation Management ────────────────────────────────

  private async generateConversationCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `CONV-${year}-`;
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.conversationModel.countDocuments({ conversationCode: { $regex: `^${prefix}` } });
      const code = `${prefix}${String(count + 1 + attempt).padStart(5, '0')}`;
      const exists = await this.conversationModel.exists({ conversationCode: code });
      if (!exists) return code;
    }
    return `${prefix}${Date.now()}`;
  }

  async findOrCreateConversation(
    fanpageId: string,
    platformUserId: string,
    customerName?: string,
    adRefParam?: string,
  ): Promise<ConversationDocument> {
    let conv = await this.conversationModel.findOne({
      fanpageId: new Types.ObjectId(fanpageId),
      platformUserId,
    });

    if (conv) {
      // Reopen if closed
      if (conv.status === ConversationStatus.CLOSED) {
        conv.status = ConversationStatus.AI_HANDLING;
        await conv.save();
      }
      return conv;
    }

    const fanpage = await this.fanpageModel.findById(fanpageId).lean();
    if (!fanpage) throw new NotFoundException('Fanpage không tồn tại');

    const conversationCode = await this.generateConversationCode();

    // Resolve ad group attribution
    let adGroupId: Types.ObjectId | undefined;
    let adGroupName: string | undefined;
    if (adRefParam) {
      const resolved = await this.resolveAdGroup(adRefParam, fanpage);
      if (resolved) {
        adGroupId = resolved.adGroupId;
        adGroupName = resolved.adGroupName;
      }
    }

    conv = new this.conversationModel({
      conversationCode,
      fanpageId: new Types.ObjectId(fanpageId),
      fanpageName: fanpage.name,
      platform: fanpage.platform,
      platformUserId,
      customerName,
      status: ConversationStatus.AI_HANDLING,
      lastMessageAt: new Date(),
      messageCount: 0,
      adRefParam,
      adGroupId,
      adGroupName,
    });

    return conv.save();
  }

  async findAllConversations(query: QueryConversationDto) {
    const filter: FilterQuery<ConversationDocument> = {};
    if (query.fanpageId) filter.fanpageId = new Types.ObjectId(query.fanpageId);
    if (query.status) filter.status = query.status;
    if (query.platform) filter.platform = query.platform;
    if (query.assignedAgentId) filter.assignedAgentId = new Types.ObjectId(query.assignedAgentId);
    if (query.search) {
      filter.$or = [
        { customerName: { $regex: query.search, $options: 'i' } },
        { customerPhone: { $regex: query.search, $options: 'i' } },
        { conversationCode: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '20', 10);
    const skip = (page - 1) * limit;
    const total = await this.conversationModel.countDocuments(filter);
    const data = await this.conversationModel.find(filter)
      .sort({ lastMessageAt: -1 })
      .skip(skip).limit(limit).lean();

    return { data, total, page, limit };
  }

  async findOneConversation(id: string) {
    const conv = await this.conversationModel.findById(id).lean();
    if (!conv) throw new NotFoundException('Hội thoại không tồn tại');
    return conv;
  }

  async updateConversation(id: string, dto: UpdateConversationDto) {
    const update: any = { ...dto };
    if (dto.assignedAgentId) {
      update.assignedAgentId = new Types.ObjectId(dto.assignedAgentId);
    }
    const doc = await this.conversationModel.findByIdAndUpdate(id, update, { new: true });
    if (!doc) throw new NotFoundException('Hội thoại không tồn tại');
    return doc;
  }

  async takeoverConversation(id: string, user: JwtPayload) {
    const conv = await this.conversationModel.findById(id);
    if (!conv) throw new NotFoundException('Hội thoại không tồn tại');
    conv.status = ConversationStatus.HUMAN_HANDLING;
    conv.assignedAgentId = new Types.ObjectId(user.sub);
    conv.assignedAgentName = user.fullName;
    return conv.save();
  }

  async releaseConversation(id: string) {
    const conv = await this.conversationModel.findById(id);
    if (!conv) throw new NotFoundException('Hội thoại không tồn tại');
    conv.status = ConversationStatus.AI_HANDLING;
    conv.assignedAgentId = undefined;
    conv.assignedAgentName = undefined;
    return conv.save();
  }

  // ─── Message Handling ───────────────────────────────────────

  async saveMessage(
    conversationId: string | Types.ObjectId,
    content: string,
    senderType: string,
    senderName?: string,
    senderUserId?: string,
    platformMessageId?: string,
  ): Promise<MessageDocument> {
    const msg = new this.messageModel({
      conversationId: new Types.ObjectId(conversationId.toString()),
      senderType,
      senderName,
      senderUserId: senderUserId ? new Types.ObjectId(senderUserId) : undefined,
      content,
      platformMessageId,
      status: MessageStatus.SENT,
    });
    const saved = await msg.save();

    // Update conversation
    await this.conversationModel.updateOne(
      { _id: new Types.ObjectId(conversationId.toString()) },
      { lastMessageAt: new Date(), $inc: { messageCount: 1 } },
    );

    return saved;
  }

  async getMessages(conversationId: string, query: QueryMessageDto) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '50', 10);
    const skip = (page - 1) * limit;

    const filter = { conversationId: new Types.ObjectId(conversationId) };
    const total = await this.messageModel.countDocuments(filter);
    const data = await this.messageModel.find(filter)
      .sort({ createdAt: 1 })
      .skip(skip).limit(limit).lean();

    return { data, total, page, limit };
  }

  async sendHumanReply(conversationId: string, dto: SendMessageDto, user: JwtPayload) {
    const conv = await this.conversationModel.findById(conversationId);
    if (!conv) throw new NotFoundException('Hội thoại không tồn tại');

    // Save message
    const msg = await this.saveMessage(
      conversationId,
      dto.content,
      SenderType.HUMAN_AGENT,
      user.fullName,
      user.sub,
    );

    // Send to platform
    try {
      const fanpage = await this.fanpageModel.findById(conv.fanpageId);
      if (fanpage?.pageAccessToken) {
        await this.sendToPlatform(fanpage, conv.platformUserId, dto.content);
      }
    } catch (err: any) {
      this.logger.error(`Failed to send reply to platform: ${err.message}`);
      await this.messageModel.updateOne(
        { _id: msg._id },
        { status: MessageStatus.FAILED, errorMessage: err.message },
      );
    }

    return msg;
  }

  // ─── AI Auto-Reply ──────────────────────────────────────────

  async handleIncomingCustomerMessage(
    fanpageId: string,
    platformUserId: string,
    content: string,
    customerName?: string,
    adRefParam?: string,
    platformMessageId?: string,
  ) {
    const fanpage = await this.fanpageModel.findById(fanpageId);
    if (!fanpage) {
      this.logger.warn(`Fanpage not found: ${fanpageId}`);
      return;
    }

    // Find or create conversation
    const conv = await this.findOrCreateConversation(
      fanpageId,
      platformUserId,
      customerName,
      adRefParam,
    );

    // Save incoming customer message
    await this.saveMessage(
      conv._id,
      content,
      SenderType.CUSTOMER,
      customerName || conv.customerName,
      undefined,
      platformMessageId,
    );

    // Update customer name if provided and not set yet
    if (customerName && !conv.customerName) {
      conv.customerName = customerName;
      await conv.save();
    }

    // AI auto-reply if enabled
    if (conv.status === ConversationStatus.AI_HANDLING && fanpage.aiAutoReplyEnabled) {
      try {
        const aiReply = await this.generateAIReply(conv, fanpage);
        if (aiReply) {
          // Save AI message
          await this.saveMessage(conv._id, aiReply, SenderType.AI, 'AI');

          // Send back to platform
          if (fanpage.pageAccessToken) {
            await this.sendToPlatform(fanpage, platformUserId, aiReply);
          }
        }
      } catch (err: any) {
        this.logger.error(`AI reply failed for conv ${conv.conversationCode}: ${err.message}`);
      }
    }
  }

  async generateAIReply(conv: ConversationDocument, fanpage: FanpageDocument): Promise<string | null> {
    if (!fanpage.openaiTokenId) {
      this.logger.warn(`No OpenAI token configured for fanpage ${fanpage.fanpageCode}`);
      return null;
    }

    const tokenData = await this.getDecryptedOpenAIKey(fanpage.openaiTokenId);
    if (!tokenData) {
      this.logger.warn(`OpenAI token inactive for fanpage ${fanpage.fanpageCode}`);
      return null;
    }

    // Build conversation context (last 20 messages)
    const recentMessages = await this.messageModel
      .find({ conversationId: conv._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // Build system prompt
    const systemPromptParts: string[] = [];
    if (tokenData.systemPromptPrefix?.trim()) {
      systemPromptParts.push(tokenData.systemPromptPrefix.trim());
    }
    systemPromptParts.push(
      `Ban la tu van vien cua fanpage "${fanpage.name}". Hay doc mo ta fanpage va lich su hoi thoai de tra loi khach hang mot cach than thien, chuyen nghiep, dung ngu canh va khong tu suy doan qua muc.`,
    );
    if (fanpage.description?.trim()) {
      systemPromptParts.push(`Mo ta fanpage va quy tac tu van:\n${fanpage.description.trim()}`);
    }
    const systemPrompt = systemPromptParts.join('\n\n');

    // Build messages array for OpenAI
    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add messages in chronological order (reverse since we sorted desc)
    for (const msg of recentMessages.reverse()) {
      if (msg.senderType === SenderType.CUSTOMER) {
        messages.push({ role: 'user', content: msg.content });
      } else if (msg.senderType === SenderType.AI || msg.senderType === SenderType.HUMAN_AGENT) {
        messages.push({ role: 'assistant', content: msg.content });
      }
    }

    // Call OpenAI API
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.key}`,
        },
        body: JSON.stringify({
          model: tokenData.model,
          messages,
          temperature: tokenData.temperature,
          max_tokens: tokenData.maxTokens,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`OpenAI API error ${response.status}: ${errBody}`);
      }

      const result = await response.json() as any;
      return result.choices?.[0]?.message?.content || null;
    } catch (err: any) {
      this.logger.error(`OpenAI API call failed: ${err.message}`);
      // Mark token as expired if auth error
      if (err.message?.includes('401')) {
        await this.openaiTokenModel.updateOne(
          { _id: fanpage.openaiTokenId },
          { status: OpenAITokenStatus.EXPIRED },
        );
      }
      throw err;
    }
  }

  // ─── Platform Messaging ─────────────────────────────────────

  async sendToPlatform(fanpage: FanpageDocument, recipientId: string, text: string) {
    const decryptedToken = this.decrypt(fanpage.pageAccessToken || '');

    if (fanpage.platform === 'FACEBOOK') {
      await this.sendFacebookMessage(decryptedToken, recipientId, text);
    } else if (fanpage.platform === 'TIKTOK') {
      await this.sendTikTokMessage(decryptedToken, recipientId, text);
    }
  }

  private async sendFacebookMessage(pageAccessToken: string, recipientId: string, text: string) {
    const url = 'https://graph.facebook.com/v21.0/me/messages';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pageAccessToken}`,
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Facebook API error ${response.status}: ${errBody}`);
    }
  }

  private async sendTikTokMessage(accessToken: string, conversationId: string, text: string) {
    const url = 'https://business-api.tiktok.com/open_api/v1.3/im/send_message/';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Access-Token': accessToken,
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        content: { text },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`TikTok API error ${response.status}: ${errBody}`);
    }
  }

  // ─── Ad Group Attribution ───────────────────────────────────

  async resolveAdGroup(adRefParam: string, fanpage: any): Promise<{ adGroupId: Types.ObjectId; adGroupName: string } | null> {
    if (!adRefParam) return null;

    // Try direct match by platformCampaignId
    let adGroup = await this.adGroupModel.findOne({
      platformCampaignId: adRefParam,
      status: 'ACTIVE',
    }).lean();

    // If not found, try matching via fanpage's linked ad account
    if (!adGroup && fanpage.adAccountId) {
      adGroup = await this.adGroupModel.findOne({
        adAccountId: fanpage.adAccountId,
        platformCampaignId: adRefParam,
      }).lean();
    }

    if (!adGroup) return null;
    return { adGroupId: adGroup._id as Types.ObjectId, adGroupName: adGroup.name };
  }

  // ─── Lead/Order Creation from Conversation ──────────────────

  async createLeadFromConversation(conversationId: string, dto: CreateLeadFromConvDto, user: JwtPayload) {
    const conv = await this.conversationModel.findById(conversationId);
    if (!conv) throw new NotFoundException('Hội thoại không tồn tại');

    if (conv.leadId) {
      throw new BadRequestException('Hội thoại này đã có lead');
    }

    // Generate lead code
    const year = new Date().getFullYear();
    const prefix = `LEAD-${year}-`;
    const last = await this.leadModel
      .findOne({ leadCode: { $regex: `^${prefix}` } })
      .sort({ leadCode: -1 })
      .lean();
    let nextNum = 1;
    if (last) {
      const parts = last.leadCode.split('-');
      nextNum = parseInt(parts[2], 10) + 1;
    }
    const leadCode = `${prefix}${String(nextNum).padStart(4, '0')}`;

    // Map platform to lead source
    const sourceMap: Record<string, string> = {
      FACEBOOK: 'FACEBOOK',
      TIKTOK: 'TIKTOK',
    };

    const lead = new this.leadModel({
      leadCode,
      parentName: dto.parentName,
      parentPhone: dto.parentPhone,
      parentEmail: dto.parentEmail,
      studentName: dto.studentName,
      interestedSubjects: dto.interestedSubjects,
      source: sourceMap[conv.platform] || 'OTHER',
      adGroupId: conv.adGroupId,
      adGroupName: conv.adGroupName,
      saleId: user.sub,
      saleName: user.fullName,
      assignedAt: new Date(),
      status: LeadStatus.NEW,
      notes: dto.notes,
      assignmentHistory: [{
        saleId: new Types.ObjectId(user.sub),
        saleName: user.fullName,
        assignedAt: new Date(),
      }],
    });

    const saved = await lead.save();

    // Link lead to conversation
    conv.leadId = saved._id as Types.ObjectId;
    conv.customerName = dto.parentName;
    conv.customerPhone = dto.parentPhone;
    await conv.save();

    await this.auditLogService.log({
      userId: user.sub,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.CREATE,
      module: 'LEADS' as any,
      targetId: saved._id?.toString(),
      targetName: saved.leadCode,
      description: `Tạo lead từ hội thoại ${conv.conversationCode}: ${saved.parentName} - ${saved.parentPhone}`,
    });

    return saved;
  }

  async createOrderFromConversation(conversationId: string, dto: CreateOrderFromConvDto, user: JwtPayload) {
    const conv = await this.conversationModel.findById(conversationId);
    if (!conv) throw new NotFoundException('Hội thoại không tồn tại');

    if (conv.orderId) {
      throw new BadRequestException('Hội thoại này đã có đơn hàng');
    }

    // Generate order code
    const year = new Date().getFullYear();
    const prefix = `ORD-${year}-`;
    const last = await this.orderModel
      .findOne({ orderCode: { $regex: `^${prefix}` } })
      .sort({ orderCode: -1 })
      .lean();
    let nextNum = 1;
    if (last) {
      const parts = (last as any).orderCode.split('-');
      nextNum = parseInt(parts[2], 10) + 1;
    }
    const orderCode = `${prefix}${String(nextNum).padStart(4, '0')}`;

    const sourceMap: Record<string, string> = {
      FACEBOOK: 'FACEBOOK',
      TIKTOK: 'TIKTOK',
    };

    // Calculate totals
    const items = dto.items.map(item => ({
      productId: new Types.ObjectId(item.productId),
      productName: item.productName,
      sessions: item.quantity,
      sessionDuration: 90,
      pricePerSession: item.unitPrice,
      amount: item.quantity * item.unitPrice,
    }));
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

    const discountAmount = dto.discountAmount || 0;
    const finalAmount = totalAmount - discountAmount;

    const order = new this.orderModel({
      orderCode,
      orderType: dto.orderType || 'NEW_ENROLLMENT',
      parentName: dto.parentName,
      parentPhone: dto.parentPhone,
      studentName: dto.studentName,
      leadSource: sourceMap[conv.platform] || 'OTHER',
      leadId: conv.leadId,
      adGroupId: conv.adGroupId,
      adGroupName: conv.adGroupName,
      items,
      totalAmount,
      discountAmount,
      discountReason: dto.discountReason,
      finalAmount,
      paymentPlan: dto.paymentPlan || 'FULL',
      status: 'DRAFT',
      saleId: new Types.ObjectId(user.sub),
      saleName: user.fullName,
      notes: dto.notes,
    });

    const saved = await order.save();

    // Link order to conversation
    conv.orderId = saved._id as Types.ObjectId;
    await conv.save();

    await this.auditLogService.log({
      userId: user.sub,
      userEmail: user.email,
      userFullName: user.fullName,
      userRole: user.role,
      action: AuditAction.CREATE,
      module: 'ORDERS' as any,
      targetId: saved._id?.toString(),
      targetName: (saved as any).orderCode,
      description: `Tạo đơn hàng từ hội thoại ${conv.conversationCode}: ${dto.parentName} - ${dto.parentPhone}`,
    });

    return saved;
  }

  // ─── Internal helpers for webhook ───────────────────────────

  async findFanpageByPageId(pageId: string): Promise<FanpageDocument | null> {
    return this.fanpageModel.findOne({ pageId });
  }

  getDecryptedAppSecret(fanpage: FanpageDocument): string {
    return fanpage.appSecret ? this.decrypt(fanpage.appSecret) : '';
  }
}
