import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import * as crypto from 'crypto';

import { AdAccount, AdAccountDocument } from './schemas/ad-account.schema';
import { AdGroup, AdGroupDocument } from './schemas/ad-group.schema';
import { ApiToken, ApiTokenDocument, ApiTokenStatus } from './schemas/api-token.schema';
import { AdCost, AdCostDocument, AdCostSource } from './schemas/ad-cost.schema';

import { CreateAdAccountDto } from './dto/create-ad-account.dto';
import { UpdateAdAccountDto } from './dto/update-ad-account.dto';
import { QueryAdAccountDto } from './dto/query-ad-account.dto';
import { CreateAdGroupDto } from './dto/create-ad-group.dto';
import { UpdateAdGroupDto } from './dto/update-ad-group.dto';
import { QueryAdGroupDto } from './dto/query-ad-group.dto';
import { CreateApiTokenDto } from './dto/create-api-token.dto';
import { UpdateApiTokenDto } from './dto/update-api-token.dto';
import { CreateAdCostDto } from './dto/create-ad-cost.dto';
import { QueryAdCostDto } from './dto/query-ad-cost.dto';

import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { Session, SessionDocument, SessionStatus } from '../sessions/schemas/session.schema';
import { Expense, ExpenseDocument } from '../expenses/schemas/expense.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@Injectable()
export class AdsService {
  private readonly logger = new Logger(AdsService.name);
  private encryptionKey: Buffer | null = null;

  constructor(
    @InjectModel(AdAccount.name) private adAccountModel: Model<AdAccountDocument>,
    @InjectModel(AdGroup.name) private adGroupModel: Model<AdGroupDocument>,
    @InjectModel(ApiToken.name) private apiTokenModel: Model<ApiTokenDocument>,
    @InjectModel(AdCost.name) private adCostModel: Model<AdCostDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Lead.name) private leadModel: Model<LeadDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(Expense.name) private expenseModel: Model<ExpenseDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    private configService: ConfigService,
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

  // ─── Ad Account CRUD ────────────────────────────────────────

  private async generateAccountCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ACC-${year}-`;
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.adAccountModel.countDocuments({ accountCode: { $regex: `^${prefix}` } });
      const code = `${prefix}${String(count + 1 + attempt).padStart(4, '0')}`;
      const exists = await this.adAccountModel.findOne({ accountCode: code }).lean();
      if (!exists) return code;
    }
    return `${prefix}${Date.now()}`;
  }

  async createAccount(dto: CreateAdAccountDto, user: JwtPayload): Promise<AdAccount> {
    const accountCode = await this.generateAccountCode();
    const account = new this.adAccountModel({
      ...dto,
      accountCode,
      createdById: user._id,
      createdByName: user.fullName,
    });
    return account.save();
  }

  async findAllAccounts(query: QueryAdAccountDto): Promise<{ data: AdAccount[]; total: number; page: number; limit: number }> {
    const filter: any = {};
    if (query.platform) filter.platform = query.platform;
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { accountCode: new RegExp(query.search, 'i') },
        { name: new RegExp(query.search, 'i') },
        { platformAccountId: new RegExp(query.search, 'i') },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.adAccountModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.adAccountModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async findOneAccount(id: string): Promise<AdAccountDocument> {
    const account = await this.adAccountModel.findById(id).exec();
    if (!account) throw new NotFoundException('Tài khoản quảng cáo không tồn tại');
    return account;
  }

  async updateAccount(id: string, dto: UpdateAdAccountDto): Promise<AdAccount> {
    const account = await this.findOneAccount(id);
    Object.assign(account, dto);
    return account.save();
  }

  async deleteAccount(id: string): Promise<void> {
    const account = await this.findOneAccount(id);
    // Check if there are ad groups linked
    const groupCount = await this.adGroupModel.countDocuments({ adAccountId: id });
    if (groupCount > 0) {
      throw new BadRequestException(`Tài khoản đang có ${groupCount} nhóm quảng cáo. Hãy xóa nhóm QC trước.`);
    }
    await this.adAccountModel.findByIdAndDelete(id).exec();
  }

  // ─── Ad Group CRUD ──────────────────────────────────────────

  private async generateGroupCode(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ADG-${year}-`;
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await this.adGroupModel.countDocuments({ groupCode: { $regex: `^${prefix}` } });
      const code = `${prefix}${String(count + 1 + attempt).padStart(4, '0')}`;
      const exists = await this.adGroupModel.findOne({ groupCode: code }).lean();
      if (!exists) return code;
    }
    return `${prefix}${Date.now()}`;
  }

  async createGroup(dto: CreateAdGroupDto, user: JwtPayload): Promise<AdGroup> {
    const account = await this.findOneAccount(dto.adAccountId);
    const groupCode = await this.generateGroupCode();
    const group = new this.adGroupModel({
      ...dto,
      groupCode,
      adAccountName: account.name,
      createdById: user._id,
      createdByName: user.fullName,
    });
    return group.save();
  }

  async findAllGroups(query: QueryAdGroupDto): Promise<{ data: AdGroup[]; total: number; page: number; limit: number }> {
    const filter: any = {};
    if (query.adAccountId) filter.adAccountId = query.adAccountId;
    if (query.platform) filter.platform = query.platform;
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { groupCode: new RegExp(query.search, 'i') },
        { name: new RegExp(query.search, 'i') },
        { platformCampaignId: new RegExp(query.search, 'i') },
      ];
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.adGroupModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.adGroupModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async findOneGroup(id: string): Promise<AdGroupDocument> {
    const group = await this.adGroupModel.findById(id).exec();
    if (!group) throw new NotFoundException('Nhóm quảng cáo không tồn tại');
    return group;
  }

  async updateGroup(id: string, dto: UpdateAdGroupDto): Promise<AdGroup> {
    const group = await this.findOneGroup(id);
    Object.assign(group, dto);
    return group.save();
  }

  async deleteGroup(id: string): Promise<void> {
    await this.findOneGroup(id);
    const costCount = await this.adCostModel.countDocuments({ adGroupId: id });
    if (costCount > 0) {
      throw new BadRequestException(`Nhóm QC đang có ${costCount} bản ghi chi phí. Không thể xóa.`);
    }
    await this.adGroupModel.findByIdAndDelete(id).exec();
  }

  async findGroupsByPlatform(platform: string): Promise<AdGroup[]> {
    return this.adGroupModel.find({ platform, status: 'ACTIVE' }).sort({ name: 1 }).lean();
  }

  async findAllGroupsSimple(): Promise<AdGroup[]> {
    return this.adGroupModel.find({ status: 'ACTIVE' }).sort({ name: 1 }).lean();
  }

  // ─── API Token Management ─────────────────────────────────

  async createToken(dto: CreateApiTokenDto, user: JwtPayload): Promise<ApiToken> {
    const account = await this.findOneAccount(dto.adAccountId);
    const token = new this.apiTokenModel({
      ...dto,
      adAccountName: account.name,
      accessToken: this.encrypt(dto.accessToken),
      refreshToken: dto.refreshToken ? this.encrypt(dto.refreshToken) : undefined,
      createdById: user._id,
    });
    return token.save();
  }

  async findTokensByAccount(accountId: string): Promise<any[]> {
    const tokens = await this.apiTokenModel.find({ adAccountId: accountId }).sort({ createdAt: -1 }).lean();
    // Mask tokens for display
    return tokens.map(t => ({
      ...t,
      accessToken: '••••••••' + (t.accessToken?.slice(-6) || ''),
      refreshToken: t.refreshToken ? '••••••••' + (t.refreshToken.slice(-6) || '') : undefined,
    }));
  }

  async updateToken(id: string, dto: UpdateApiTokenDto): Promise<ApiToken> {
    const token = await this.apiTokenModel.findById(id).exec();
    if (!token) throw new NotFoundException('Token không tồn tại');

    if (dto.accessToken) token.accessToken = this.encrypt(dto.accessToken);
    if (dto.refreshToken) token.refreshToken = this.encrypt(dto.refreshToken);
    if (dto.expiresAt) token.expiresAt = new Date(dto.expiresAt);
    if (dto.status) token.status = dto.status;
    if (dto.label) token.label = dto.label;

    return token.save();
  }

  async deleteToken(id: string): Promise<void> {
    const token = await this.apiTokenModel.findById(id).exec();
    if (!token) throw new NotFoundException('Token không tồn tại');
    await this.apiTokenModel.findByIdAndDelete(id).exec();
  }

  private async getDecryptedToken(accountId: string): Promise<string | null> {
    const token = await this.apiTokenModel.findOne({
      adAccountId: accountId,
      status: ApiTokenStatus.ACTIVE,
    }).exec();
    if (!token) return null;

    // Check expiry
    if (token.expiresAt && token.expiresAt < new Date()) {
      token.status = ApiTokenStatus.EXPIRED;
      await token.save();
      return null;
    }

    token.lastUsedAt = new Date();
    await token.save();

    return this.decrypt(token.accessToken);
  }

  // ─── Ad Cost Management ────────────────────────────────────

  async createOrUpdateCost(dto: CreateAdCostDto): Promise<AdCost> {
    const costDate = new Date(dto.date);
    costDate.setHours(0, 0, 0, 0);

    const group = await this.findOneGroup(dto.adGroupId);

    const result = await this.adCostModel.findOneAndUpdate(
      { adGroupId: dto.adGroupId, date: costDate },
      {
        $set: {
          adAccountId: dto.adAccountId,
          adGroupName: group.name,
          platform: dto.platform,
          spend: dto.spend,
          impressions: dto.impressions || 0,
          clicks: dto.clicks || 0,
          conversions: dto.conversions || 0,
          source: dto.source || AdCostSource.MANUAL,
          syncedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    ).exec();

    return result!;
  }

  async findAllCosts(query: QueryAdCostDto): Promise<{ data: AdCost[]; total: number; page: number; limit: number }> {
    const filter: any = {};
    if (query.adGroupId) filter.adGroupId = query.adGroupId;
    if (query.adAccountId) filter.adAccountId = query.adAccountId;
    if (query.platform) filter.platform = query.platform;
    if (query.startDate || query.endDate) {
      filter.date = {};
      if (query.startDate) filter.date.$gte = new Date(query.startDate);
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(query.limit) || 50));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.adCostModel.find(filter).sort({ date: -1 }).skip(skip).limit(limit).exec(),
      this.adCostModel.countDocuments(filter),
    ]);

    return { data, total, page, limit };
  }

  async deleteCost(id: string): Promise<void> {
    const cost = await this.adCostModel.findById(id).exec();
    if (!cost) throw new NotFoundException('Bản ghi chi phí không tồn tại');
    await this.adCostModel.findByIdAndDelete(id).exec();
  }

  // ─── Ad Cost Sync ─────────────────────────────────────────

  @Cron('0 6 * * *')
  async syncAllAdCosts(): Promise<{ synced: number; errors: string[] }> {
    this.logger.log('Starting daily ad cost sync...');
    const accounts = await this.adAccountModel.find({ status: 'ACTIVE' }).exec();
    let synced = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      try {
        const count = await this.syncAccountCosts(account._id.toString());
        synced += count;
      } catch (err: any) {
        const msg = `${account.name} (${account.platform}): ${err.message}`;
        errors.push(msg);
        this.logger.error(msg);
      }
    }

    this.logger.log(`Ad cost sync complete. Synced: ${synced}, Errors: ${errors.length}`);
    return { synced, errors };
  }

  async syncAccountCosts(accountId: string, dateStr?: string): Promise<number> {
    const account = await this.findOneAccount(accountId);
    const token = await this.getDecryptedToken(accountId);
    if (!token) {
      throw new BadRequestException(`Không tìm thấy API token hợp lệ cho tài khoản ${account.name}`);
    }

    const groups = await this.adGroupModel.find({ adAccountId: accountId, status: 'ACTIVE' }).exec();
    if (groups.length === 0) return 0;

    // Default: sync yesterday's data
    const syncDate = dateStr ? new Date(dateStr) : new Date(Date.now() - 86400000);
    syncDate.setHours(0, 0, 0, 0);

    let synced = 0;

    switch (account.platform) {
      case 'FACEBOOK':
        synced = await this.syncFacebookCosts(token, account, groups, syncDate);
        break;
      case 'GOOGLE':
        synced = await this.syncGoogleCosts(token, account, groups, syncDate);
        break;
      case 'TIKTOK':
        synced = await this.syncTikTokCosts(token, account, groups, syncDate);
        break;
    }

    return synced;
  }

  private async syncFacebookCosts(
    token: string, account: AdAccountDocument, groups: AdGroupDocument[], date: Date,
  ): Promise<number> {
    const dateStr = date.toISOString().split('T')[0];
    let synced = 0;

    try {
      const url = `https://graph.facebook.com/v21.0/act_${account.platformAccountId}/insights`
        + `?fields=spend,impressions,clicks,actions`
        + `&level=campaign`
        + `&time_range={"since":"${dateStr}","until":"${dateStr}"}`
        + `&access_token=${token}`;

      const response = await this.fetchWithRetry(url);
      const data = response?.data || [];

      const campaignMap = new Map<string, AdGroupDocument>();
      for (const g of groups) {
        campaignMap.set(g.platformCampaignId, g);
      }

      for (const row of data) {
        const campaignId = row.campaign_id;
        const group = campaignMap.get(campaignId);
        if (!group) continue;

        const conversions = (row.actions || [])
          .filter((a: any) => a.action_type === 'offsite_conversion')
          .reduce((sum: number, a: any) => sum + Number(a.value || 0), 0);

        await this.createOrUpdateCost({
          adGroupId: group._id.toString(),
          adAccountId: account._id.toString(),
          platform: 'FACEBOOK',
          date: dateStr,
          spend: Number(row.spend || 0) * this.getExchangeRate('USD'),
          impressions: Number(row.impressions || 0),
          clicks: Number(row.clicks || 0),
          conversions,
          source: AdCostSource.SYNCED,
        });
        synced++;
      }
    } catch (err: any) {
      this.logger.error(`Facebook sync error: ${err.message}`);
      throw err;
    }

    return synced;
  }

  private async syncGoogleCosts(
    token: string, account: AdAccountDocument, groups: AdGroupDocument[], date: Date,
  ): Promise<number> {
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    let synced = 0;

    try {
      const query = `SELECT campaign.id, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions`
        + ` FROM campaign WHERE segments.date = '${dateStr}'`;

      const url = `https://googleads.googleapis.com/v17/customers/${account.platformAccountId}/googleAds:searchStream`;

      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'developer-token': this.configService.get<string>('GOOGLE_ADS_DEV_TOKEN', ''),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      const campaignMap = new Map<string, AdGroupDocument>();
      for (const g of groups) {
        campaignMap.set(g.platformCampaignId, g);
      }

      const results = response?.[0]?.results || [];
      for (const row of results) {
        const campaignId = row.campaign?.id?.toString();
        if (!campaignId) continue;
        const group = campaignMap.get(campaignId);
        if (!group) continue;

        const costVnd = (Number(row.metrics?.cost_micros || 0) / 1_000_000) * this.getExchangeRate('USD');

        await this.createOrUpdateCost({
          adGroupId: group._id.toString(),
          adAccountId: account._id.toString(),
          platform: 'GOOGLE',
          date: date.toISOString().split('T')[0],
          spend: costVnd,
          impressions: Number(row.metrics?.impressions || 0),
          clicks: Number(row.metrics?.clicks || 0),
          conversions: Number(row.metrics?.conversions || 0),
          source: AdCostSource.SYNCED,
        });
        synced++;
      }
    } catch (err: any) {
      this.logger.error(`Google sync error: ${err.message}`);
      throw err;
    }

    return synced;
  }

  private async syncTikTokCosts(
    token: string, account: AdAccountDocument, groups: AdGroupDocument[], date: Date,
  ): Promise<number> {
    const dateStr = date.toISOString().split('T')[0];
    let synced = 0;

    try {
      const url = `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/`
        + `?advertiser_id=${account.platformAccountId}`
        + `&report_type=BASIC`
        + `&dimensions=["campaign_id","stat_time_day"]`
        + `&metrics=["spend","impressions","clicks","conversions"]`
        + `&data_level=AUCTION_CAMPAIGN`
        + `&start_date=${dateStr}&end_date=${dateStr}`;

      const response = await this.fetchWithRetry(url, {
        headers: { 'Access-Token': token },
      });

      const campaignMap = new Map<string, AdGroupDocument>();
      for (const g of groups) {
        campaignMap.set(g.platformCampaignId, g);
      }

      const rows = response?.data?.list || [];
      for (const row of rows) {
        const campaignId = row.dimensions?.campaign_id;
        if (!campaignId) continue;
        const group = campaignMap.get(campaignId);
        if (!group) continue;

        await this.createOrUpdateCost({
          adGroupId: group._id.toString(),
          adAccountId: account._id.toString(),
          platform: 'TIKTOK',
          date: dateStr,
          spend: Number(row.metrics?.spend || 0) * this.getExchangeRate('USD'),
          impressions: Number(row.metrics?.impressions || 0),
          clicks: Number(row.metrics?.clicks || 0),
          conversions: Number(row.metrics?.conversions || 0),
          source: AdCostSource.SYNCED,
        });
        synced++;
      }
    } catch (err: any) {
      this.logger.error(`TikTok sync error: ${err.message}`);
      throw err;
    }

    return synced;
  }

  private getExchangeRate(currency: string): number {
    // Configurable via env, default VND rates
    if (currency === 'USD') {
      return Number(this.configService.get<string>('USD_TO_VND', '25000'));
    }
    return 1;
  }

  private async fetchWithRetry(url: string, options: any = {}, retries = 3): Promise<any> {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          const body = await response.text();
          throw new Error(`HTTP ${response.status}: ${body}`);
        }
        return response.json();
      } catch (err: any) {
        if (i === retries - 1) throw err;
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
      }
    }
  }

  // ─── Analytics ─────────────────────────────────────────────

  async getAnalytics(startDate: string, endDate: string, adGroupId?: string, platform?: string): Promise<any> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Get ad costs aggregated by group
    const costMatch: any = { date: { $gte: start, $lte: end } };
    if (adGroupId) costMatch.adGroupId = new Types.ObjectId(adGroupId);
    if (platform) costMatch.platform = platform;

    const costsByGroup = await this.adCostModel.aggregate([
      { $match: costMatch },
      {
        $group: {
          _id: '$adGroupId',
          totalSpend: { $sum: '$spend' },
          totalImpressions: { $sum: '$impressions' },
          totalClicks: { $sum: '$clicks' },
          totalConversions: { $sum: '$conversions' },
          adGroupName: { $first: '$adGroupName' },
          platform: { $first: '$platform' },
        },
      },
    ]);

    // Get leads count per ad group
    const leadMatch: any = { adGroupId: { $exists: true, $ne: null }, createdAt: { $gte: start, $lte: end } };
    if (adGroupId) leadMatch.adGroupId = new Types.ObjectId(adGroupId);

    const leadsByGroup = await this.leadModel.aggregate([
      { $match: leadMatch },
      { $group: { _id: '$adGroupId', leadCount: { $sum: 1 } } },
    ]);
    const leadMap = new Map(leadsByGroup.map(l => [l._id.toString(), l.leadCount]));

    // Get orders count and revenue per ad group
    const orderMatch: any = {
      adGroupId: { $exists: true, $ne: null },
      createdAt: { $gte: start, $lte: end },
      status: { $in: ['APPROVED', 'COMPLETED'] },
    };
    if (adGroupId) orderMatch.adGroupId = new Types.ObjectId(adGroupId);

    const ordersByGroup = await this.orderModel.aggregate([
      { $match: orderMatch },
      {
        $group: {
          _id: '$adGroupId',
          orderCount: { $sum: 1 },
          revenue: { $sum: '$finalAmount' },
        },
      },
    ]);
    const orderMap = new Map(ordersByGroup.map(o => [o._id.toString(), o]));

    // Combine results
    const rows = costsByGroup.map(cost => {
      const gId = cost._id.toString();
      const leadCount = leadMap.get(gId) || 0;
      const orderData = orderMap.get(gId) || { orderCount: 0, revenue: 0 };
      const netProfit = orderData.revenue - cost.totalSpend;
      const roi = cost.totalSpend > 0 ? (netProfit / cost.totalSpend) * 100 : 0;

      return {
        adGroupId: gId,
        adGroupName: cost.adGroupName || '',
        platform: cost.platform,
        totalSpend: cost.totalSpend,
        totalImpressions: cost.totalImpressions,
        totalClicks: cost.totalClicks,
        totalConversions: cost.totalConversions,
        leadCount,
        orderCount: orderData.orderCount,
        revenue: orderData.revenue,
        costPerLead: leadCount > 0 ? Math.round(cost.totalSpend / leadCount) : null,
        costPerOrder: orderData.orderCount > 0 ? Math.round(cost.totalSpend / orderData.orderCount) : null,
        netProfit,
        roi: Math.round(roi * 100) / 100,
      };
    });

    // Summary
    const summary = {
      totalSpend: rows.reduce((s, r) => s + r.totalSpend, 0),
      totalLeads: rows.reduce((s, r) => s + r.leadCount, 0),
      totalOrders: rows.reduce((s, r) => s + r.orderCount, 0),
      totalRevenue: rows.reduce((s, r) => s + r.revenue, 0),
      totalNetProfit: rows.reduce((s, r) => s + r.netProfit, 0),
      avgCostPerLead: 0,
      avgCostPerOrder: 0,
      avgRoi: 0,
    };

    if (summary.totalLeads > 0) summary.avgCostPerLead = Math.round(summary.totalSpend / summary.totalLeads);
    if (summary.totalOrders > 0) summary.avgCostPerOrder = Math.round(summary.totalSpend / summary.totalOrders);
    if (summary.totalSpend > 0) summary.avgRoi = Math.round((summary.totalNetProfit / summary.totalSpend) * 10000) / 100;

    return { rows, summary };
  }

  // ─── Net Profit By Ad Group (Per Day) ─────────────────────

  /**
   * Tính lợi nhuận thuần trên mỗi nhóm quảng cáo theo ngày.
   *
   * Công thức:
   *   grossProfit = Σ(amountCharged - teacherPayout) của sessions thuộc adGroup ngày đó
   *   overheadPerSession = totalExpenses(ngày) / totalSessions(ngày)
   *   allocatedOverhead = overheadPerSession × sessionCount(adGroup, ngày)
   *   netProfit = grossProfit - allocatedOverhead - adSpend(adGroup, ngày)
   */
  async getNetProfitByAdGroup(
    startDate: string,
    endDate: string,
    adGroupId?: string,
  ): Promise<any> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // ── 1. Sessions FINALIZED theo adGroupId + ngày ──
    const sessionMatch: any = {
      adGroupId: { $exists: true, $ne: null },
      status: SessionStatus.FINALIZED,
      scheduledDate: { $gte: start, $lte: end },
    };
    if (adGroupId) sessionMatch.adGroupId = new Types.ObjectId(adGroupId);

    const sessionsByGroupDay = await this.sessionModel.aggregate([
      { $match: sessionMatch },
      {
        $group: {
          _id: {
            adGroupId: '$adGroupId',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$scheduledDate' } },
          },
          revenue: { $sum: '$amountCharged' },
          teacherCost: { $sum: '$teacherPayout' },
          sessionCount: { $sum: 1 },
          adGroupName: { $first: '$adGroupName' },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    // ── 2. Tổng sessions FINALIZED tất cả theo ngày (để chia overhead) ──
    const totalSessionsByDay = await this.sessionModel.aggregate([
      {
        $match: {
          status: SessionStatus.FINALIZED,
          scheduledDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$scheduledDate' } },
          totalSessions: { $sum: 1 },
        },
      },
    ]);
    const totalSessionMap = new Map(
      totalSessionsByDay.map(d => [d._id, d.totalSessions]),
    );

    // ── 3. Expenses PAID theo ngày ──
    const expensesByDay = await this.expenseModel.aggregate([
      {
        $match: {
          paymentStatus: 'PAID',
          expenseDate: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$expenseDate' } },
          totalExpense: { $sum: '$amount' },
        },
      },
    ]);
    const expenseMap = new Map(
      expensesByDay.map(d => [d._id, d.totalExpense]),
    );

    // ── 4. Ad costs theo adGroupId + ngày ──
    const adCostMatch: any = { date: { $gte: start, $lte: end } };
    if (adGroupId) adCostMatch.adGroupId = new Types.ObjectId(adGroupId);

    const adCostsByGroupDay = await this.adCostModel.aggregate([
      { $match: adCostMatch },
      {
        $group: {
          _id: {
            adGroupId: '$adGroupId',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          },
          adSpend: { $sum: '$spend' },
          adGroupName: { $first: '$adGroupName' },
          platform: { $first: '$platform' },
        },
      },
    ]);
    const adCostMap = new Map(
      adCostsByGroupDay.map(c => [
        `${c._id.adGroupId}_${c._id.date}`,
        c,
      ]),
    );

    // ── 5. Tính lợi nhuận thuần ──
    // Collect all unique group+date keys from both sessions and adCosts
    const allKeys = new Set<string>();
    const groupInfoMap = new Map<string, { adGroupName: string; platform?: string }>();

    for (const s of sessionsByGroupDay) {
      const key = `${s._id.adGroupId}_${s._id.date}`;
      allKeys.add(key);
      if (!groupInfoMap.has(s._id.adGroupId.toString())) {
        // Lấy platform từ adCost nếu có
        const costInfo = adCostMap.get(key);
        groupInfoMap.set(s._id.adGroupId.toString(), {
          adGroupName: s.adGroupName || '',
          platform: costInfo?.platform || '',
        });
      }
    }

    for (const c of adCostsByGroupDay) {
      const key = `${c._id.adGroupId}_${c._id.date}`;
      allKeys.add(key);
      if (!groupInfoMap.has(c._id.adGroupId.toString())) {
        groupInfoMap.set(c._id.adGroupId.toString(), {
          adGroupName: c.adGroupName || '',
          platform: c.platform || '',
        });
      }
    }

    // Build session data map
    const sessionDataMap = new Map(
      sessionsByGroupDay.map(s => [
        `${s._id.adGroupId}_${s._id.date}`,
        s,
      ]),
    );

    const daily: any[] = [];

    for (const key of allKeys) {
      const [gId, date] = [key.substring(0, 24), key.substring(25)];

      const sessionData = sessionDataMap.get(key);
      const revenue = sessionData?.revenue || 0;
      const teacherCost = sessionData?.teacherCost || 0;
      const sessionCount = sessionData?.sessionCount || 0;

      const grossProfit = revenue - teacherCost;

      const totalSessionsOfDay = totalSessionMap.get(date) || 1;
      const totalExpenseOfDay = expenseMap.get(date) || 0;
      const overheadPerSession = totalExpenseOfDay / totalSessionsOfDay;
      const allocatedOverhead = Math.round(overheadPerSession * sessionCount);

      const adCostData = adCostMap.get(key);
      const adSpend = adCostData?.adSpend || 0;

      const netProfit = grossProfit - allocatedOverhead - adSpend;

      const info = groupInfoMap.get(gId);

      daily.push({
        date,
        adGroupId: gId,
        adGroupName: info?.adGroupName || '',
        platform: info?.platform || '',
        sessionCount,
        revenue,
        teacherCost,
        grossProfit,
        totalExpenseOfDay,
        totalSessionsOfDay,
        overheadPerSession: Math.round(overheadPerSession),
        allocatedOverhead,
        adSpend,
        netProfit,
        netMargin: revenue > 0 ? Math.round((netProfit / revenue) * 10000) / 100 : 0,
      });
    }

    // Sort by date, then adGroupId
    daily.sort((a, b) => a.date.localeCompare(b.date) || a.adGroupId.localeCompare(b.adGroupId));

    // ── 6. Summary per ad group ──
    const groupSummaryMap = new Map<string, any>();
    for (const row of daily) {
      if (!groupSummaryMap.has(row.adGroupId)) {
        groupSummaryMap.set(row.adGroupId, {
          adGroupId: row.adGroupId,
          adGroupName: row.adGroupName,
          platform: row.platform,
          totalRevenue: 0,
          totalTeacherCost: 0,
          totalGrossProfit: 0,
          totalAllocatedOverhead: 0,
          totalAdSpend: 0,
          totalNetProfit: 0,
          totalSessions: 0,
          days: 0,
        });
      }
      const s = groupSummaryMap.get(row.adGroupId);
      s.totalRevenue += row.revenue;
      s.totalTeacherCost += row.teacherCost;
      s.totalGrossProfit += row.grossProfit;
      s.totalAllocatedOverhead += row.allocatedOverhead;
      s.totalAdSpend += row.adSpend;
      s.totalNetProfit += row.netProfit;
      s.totalSessions += row.sessionCount;
      s.days += 1;
    }

    const summaryByGroup = Array.from(groupSummaryMap.values()).map(s => ({
      ...s,
      netMargin: s.totalRevenue > 0
        ? Math.round((s.totalNetProfit / s.totalRevenue) * 10000) / 100
        : 0,
      avgNetProfitPerDay: s.days > 0 ? Math.round(s.totalNetProfit / s.days) : 0,
      avgNetProfitPerSession: s.totalSessions > 0
        ? Math.round(s.totalNetProfit / s.totalSessions)
        : 0,
    }));

    // Overall summary
    const overall = {
      totalRevenue: summaryByGroup.reduce((s, r) => s + r.totalRevenue, 0),
      totalTeacherCost: summaryByGroup.reduce((s, r) => s + r.totalTeacherCost, 0),
      totalGrossProfit: summaryByGroup.reduce((s, r) => s + r.totalGrossProfit, 0),
      totalAllocatedOverhead: summaryByGroup.reduce((s, r) => s + r.totalAllocatedOverhead, 0),
      totalAdSpend: summaryByGroup.reduce((s, r) => s + r.totalAdSpend, 0),
      totalNetProfit: summaryByGroup.reduce((s, r) => s + r.totalNetProfit, 0),
      totalSessions: summaryByGroup.reduce((s, r) => s + r.totalSessions, 0),
      netMargin: 0,
    };
    if (overall.totalRevenue > 0) {
      overall.netMargin = Math.round((overall.totalNetProfit / overall.totalRevenue) * 10000) / 100;
    }

    return { daily, summaryByGroup, overall };
  }

  // ─── Backfill adGroupId cho dữ liệu cũ ───────────────────

  /**
   * Cập nhật adGroupId từ Order → Student → Session cho dữ liệu đã tồn tại.
   * Gọi 1 lần hoặc khi cần đồng bộ lại.
   */
  async backfillAdGroupIds(): Promise<{
    studentsUpdated: number;
    sessionsUpdated: number;
  }> {
    let studentsUpdated = 0;
    let sessionsUpdated = 0;

    // Tìm Orders có adGroupId và processedResults.studentId
    const orders = await this.orderModel.find({
      adGroupId: { $exists: true, $ne: null },
      'processedResults.studentId': { $exists: true, $ne: null },
    }).lean();

    for (const order of orders) {
      const o = order as any;
      const studentId = o.processedResults?.studentId;
      if (!studentId) continue;

      // Update Student
      const studentResult = await this.studentModel.updateOne(
        { _id: studentId, adGroupId: { $exists: false } },
        {
          $set: {
            orderId: o._id,
            adGroupId: o.adGroupId,
            adGroupName: o.adGroupName || undefined,
          },
        },
      );
      if (studentResult.modifiedCount > 0) studentsUpdated++;

      // Update Sessions thuộc student này
      const sessionResult = await this.sessionModel.updateMany(
        { studentId: studentId, adGroupId: { $exists: false } },
        {
          $set: {
            orderId: o._id,
            adGroupId: o.adGroupId,
            adGroupName: o.adGroupName || undefined,
          },
        },
      );
      sessionsUpdated += sessionResult.modifiedCount;
    }

    this.logger.log(
      `Backfill complete: ${studentsUpdated} students, ${sessionsUpdated} sessions updated`,
    );

    return { studentsUpdated, sessionsUpdated };
  }

  // ─── Budget Suggestions (Diminishing Marginal Returns) ────

  async getSuggestions(startDate: string, endDate: string, totalBudget: number): Promise<any> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Get daily data per group
    const dailyData = await this.adCostModel.aggregate([
      { $match: { date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { adGroupId: '$adGroupId', date: '$date' },
          spend: { $sum: '$spend' },
          adGroupName: { $first: '$adGroupName' },
          platform: { $first: '$platform' },
        },
      },
      { $sort: { '_id.date': 1 } },
    ]);

    // Get daily orders per ad group
    const dailyOrders = await this.orderModel.aggregate([
      {
        $match: {
          adGroupId: { $exists: true, $ne: null },
          createdAt: { $gte: start, $lte: end },
          status: { $in: ['APPROVED', 'COMPLETED'] },
        },
      },
      {
        $group: {
          _id: {
            adGroupId: '$adGroupId',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          },
          orders: { $sum: 1 },
          revenue: { $sum: '$finalAmount' },
        },
      },
    ]);

    const orderMap = new Map<string, Map<string, { orders: number; revenue: number }>>();
    for (const o of dailyOrders) {
      const gId = o._id.adGroupId.toString();
      if (!orderMap.has(gId)) orderMap.set(gId, new Map());
      orderMap.get(gId)!.set(o._id.date, { orders: o.orders, revenue: o.revenue });
    }

    // Organize data by ad group
    const groupData = new Map<string, {
      name: string;
      platform: string;
      points: Array<{ spend: number; orders: number; revenue: number }>;
    }>();

    for (const row of dailyData) {
      const gId = row._id.adGroupId.toString();
      if (!groupData.has(gId)) {
        groupData.set(gId, { name: row.adGroupName || '', platform: row.platform, points: [] });
      }
      const dateStr = row._id.date.toISOString().split('T')[0];
      const orderInfo = orderMap.get(gId)?.get(dateStr) || { orders: 0, revenue: 0 };
      groupData.get(gId)!.points.push({
        spend: row.spend,
        orders: orderInfo.orders,
        revenue: orderInfo.revenue,
      });
    }

    // Fit logarithmic curves and calculate suggestions
    const suggestions: any[] = [];

    for (const [gId, data] of groupData) {
      const points = data.points;
      const currentAvgSpend = points.reduce((s, p) => s + p.spend, 0) / points.length;

      if (points.length < 7) {
        // Not enough data for curve fitting
        suggestions.push({
          adGroupId: gId,
          adGroupName: data.name,
          platform: data.platform,
          currentDailySpend: Math.round(currentAvgSpend),
          suggestedDailySpend: null,
          expectedOrders: null,
          expectedRevenue: null,
          expectedCostPerOrder: null,
          changePercent: null,
          confidence: 'LOW',
          dataPoints: points.length,
          coeffA: null,
          coeffB: null,
        });
        continue;
      }

      // Fit: orders = a * ln(spend + 1) + b using least squares
      const { a, b, rSquared } = this.fitLogCurve(
        points.map(p => p.spend),
        points.map(p => p.orders),
      );

      // Also fit revenue curve
      const revFit = this.fitLogCurve(
        points.map(p => p.spend),
        points.map(p => p.revenue),
      );

      suggestions.push({
        adGroupId: gId,
        adGroupName: data.name,
        platform: data.platform,
        currentDailySpend: Math.round(currentAvgSpend),
        suggestedDailySpend: 0, // Will be filled by greedy allocation
        expectedOrders: 0,
        expectedRevenue: 0,
        expectedCostPerOrder: null,
        changePercent: 0,
        confidence: rSquared >= 0.5 ? 'HIGH' : rSquared >= 0.2 ? 'MEDIUM' : 'LOW',
        dataPoints: points.length,
        coeffA: a,
        coeffB: b,
        revCoeffA: revFit.a,
        revCoeffB: revFit.b,
        marginalReturn: a > 0 ? a / (currentAvgSpend + 1) : 0,
      });
    }

    // Greedy allocation for groups with sufficient data
    const allocatable = suggestions.filter(s => s.coeffA !== null && s.coeffA > 0);
    const step = 100000; // 100K VND increments
    const allocations = new Map<string, number>();
    for (const s of allocatable) {
      allocations.set(s.adGroupId, 0);
    }

    let remaining = totalBudget;
    while (remaining >= step && allocatable.length > 0) {
      // Find group with highest marginal return at current allocation
      let bestGroup: any = null;
      let bestMarginal = -Infinity;

      for (const s of allocatable) {
        const currentAlloc = allocations.get(s.adGroupId)!;
        const marginal = s.coeffA / (currentAlloc + 1);
        if (marginal > bestMarginal) {
          bestMarginal = marginal;
          bestGroup = s;
        }
      }

      if (!bestGroup || bestMarginal <= 0) break;

      allocations.set(bestGroup.adGroupId, allocations.get(bestGroup.adGroupId)! + step);
      remaining -= step;
    }

    // Distribute remaining to LOW confidence groups equally
    const lowConfidence = suggestions.filter(s => s.confidence === 'LOW');
    if (lowConfidence.length > 0 && remaining > 0) {
      const perGroup = Math.floor(remaining / lowConfidence.length);
      for (const s of lowConfidence) {
        allocations.set(s.adGroupId, (allocations.get(s.adGroupId) || 0) + perGroup);
      }
    }

    // Update suggestions with allocation results
    for (const s of suggestions) {
      const alloc = allocations.get(s.adGroupId) || 0;
      s.suggestedDailySpend = alloc;

      if (s.coeffA !== null) {
        s.expectedOrders = Math.max(0, Math.round((s.coeffA * Math.log(alloc + 1) + s.coeffB) * 100) / 100);
        s.expectedRevenue = Math.max(0, Math.round(s.revCoeffA * Math.log(alloc + 1) + s.revCoeffB));
        s.expectedCostPerOrder = s.expectedOrders > 0 ? Math.round(alloc / s.expectedOrders) : null;
      }

      s.changePercent = s.currentDailySpend > 0
        ? Math.round(((alloc - s.currentDailySpend) / s.currentDailySpend) * 100)
        : null;

      // Clean up internal coefficients
      delete s.coeffA;
      delete s.coeffB;
      delete s.revCoeffA;
      delete s.revCoeffB;
      delete s.marginalReturn;
    }

    return {
      totalBudget,
      allocated: suggestions.reduce((s, r) => s + (r.suggestedDailySpend || 0), 0),
      suggestions: suggestions.sort((a, b) => (b.suggestedDailySpend || 0) - (a.suggestedDailySpend || 0)),
    };
  }

  /**
   * Fit: y = a * ln(x + 1) + b using least squares
   * Returns coefficients and R-squared
   */
  private fitLogCurve(xValues: number[], yValues: number[]): { a: number; b: number; rSquared: number } {
    const n = xValues.length;
    if (n < 2) return { a: 0, b: 0, rSquared: 0 };

    // Transform: let X = ln(x + 1), fit Y = a*X + b
    const X = xValues.map(x => Math.log(x + 1));
    const Y = yValues;

    const sumX = X.reduce((s, v) => s + v, 0);
    const sumY = Y.reduce((s, v) => s + v, 0);
    const sumXY = X.reduce((s, v, i) => s + v * Y[i], 0);
    const sumXX = X.reduce((s, v) => s + v * v, 0);

    const denom = n * sumXX - sumX * sumX;
    if (Math.abs(denom) < 1e-10) return { a: 0, b: sumY / n, rSquared: 0 };

    const a = (n * sumXY - sumX * sumY) / denom;
    const b = (sumY - a * sumX) / n;

    // R-squared
    const meanY = sumY / n;
    const ssTotal = Y.reduce((s, y) => s + (y - meanY) ** 2, 0);
    const ssResidual = Y.reduce((s, y, i) => s + (y - (a * X[i] + b)) ** 2, 0);
    const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

    return { a, b, rSquared: Math.max(0, rSquared) };
  }
}
