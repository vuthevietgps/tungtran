import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { AdsService } from './ads.service';
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
import { QueryAdsAnalyticsDto } from './dto/query-ads-analytics.dto';
import { QueryAdsProfitDto } from './dto/query-ads-profit.dto';
import { QueryAdsSuggestionsDto } from './dto/query-ads-suggestions.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';

@Controller('ads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  // ─── Ad Accounts ────────────────────────────────────────

  @Get('accounts')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE)
  async findAllAccounts(@Query() query: QueryAdAccountDto) {
    return this.adsService.findAllAccounts(query);
  }

  @Get('accounts/:id')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE)
  async findOneAccount(@Param('id', ParseMongoIdPipe) id: string) {
    return this.adsService.findOneAccount(id);
  }

  @Post('accounts')
  @Roles(Role.DIRECTOR)
  async createAccount(@Body() dto: CreateAdAccountDto, @Req() req: AuthenticatedRequest) {
    return this.adsService.createAccount(dto, req.user);
  }

  @Patch('accounts/:id')
  @Roles(Role.DIRECTOR)
  async updateAccount(@Param('id', ParseMongoIdPipe) id: string, @Body() dto: UpdateAdAccountDto) {
    return this.adsService.updateAccount(id, dto);
  }

  @Delete('accounts/:id')
  @Roles(Role.DIRECTOR)
  async deleteAccount(@Param('id', ParseMongoIdPipe) id: string) {
    await this.adsService.deleteAccount(id);
    return { message: 'Đã xóa tài khoản quảng cáo' };
  }

  // ─── Ad Groups ──────────────────────────────────────────

  @Get('groups')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE)
  async findAllGroups(@Query() query: QueryAdGroupDto) {
    return this.adsService.findAllGroups(query);
  }

  @Get('groups/all')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE)
  async findAllGroupsSimple() {
    return this.adsService.findAllGroupsSimple();
  }

  @Get('groups/by-platform/:platform')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE)
  async findGroupsByPlatform(@Param('platform') platform: string) {
    return this.adsService.findGroupsByPlatform(platform);
  }

  @Get('groups/:id')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE)
  async findOneGroup(@Param('id', ParseMongoIdPipe) id: string) {
    return this.adsService.findOneGroup(id);
  }

  @Post('groups')
  @Roles(Role.DIRECTOR, Role.OPS)
  async createGroup(@Body() dto: CreateAdGroupDto, @Req() req: AuthenticatedRequest) {
    return this.adsService.createGroup(dto, req.user);
  }

  @Patch('groups/:id')
  @Roles(Role.DIRECTOR, Role.OPS)
  async updateGroup(@Param('id', ParseMongoIdPipe) id: string, @Body() dto: UpdateAdGroupDto) {
    return this.adsService.updateGroup(id, dto);
  }

  @Delete('groups/:id')
  @Roles(Role.DIRECTOR)
  async deleteGroup(@Param('id', ParseMongoIdPipe) id: string) {
    await this.adsService.deleteGroup(id);
    return { message: 'Đã xóa nhóm quảng cáo' };
  }

  // ─── API Tokens ─────────────────────────────────────────

  @Get('tokens')
  @Roles(Role.DIRECTOR)
  async findAllTokens(@Query('accountId') accountId?: string) {
    return accountId
      ? this.adsService.findTokensByAccount(accountId)
      : this.adsService.findAllTokens();
  }

  @Get('tokens/:accountId')
  @Roles(Role.DIRECTOR)
  async findTokens(@Param('accountId', ParseMongoIdPipe) accountId: string) {
    return this.adsService.findTokensByAccount(accountId);
  }

  @Post('tokens')
  @Roles(Role.DIRECTOR)
  async createToken(@Body() dto: CreateApiTokenDto, @Req() req: AuthenticatedRequest) {
    return this.adsService.createToken(dto, req.user);
  }

  @Patch('tokens/:id')
  @Roles(Role.DIRECTOR)
  async updateToken(@Param('id', ParseMongoIdPipe) id: string, @Body() dto: UpdateApiTokenDto) {
    return this.adsService.updateToken(id, dto);
  }

  @Delete('tokens/:id')
  @Roles(Role.DIRECTOR)
  async deleteToken(@Param('id', ParseMongoIdPipe) id: string) {
    await this.adsService.deleteToken(id);
    return { message: 'Đã xóa token' };
  }

  // ─── Ad Costs ───────────────────────────────────────────

  @Post('tokens/:id/sync-facebook-business')
  @Roles(Role.DIRECTOR)
  async syncFacebookBusinessToken(
    @Param('id', ParseMongoIdPipe) id: string,
    @Query('date') date?: string,
  ) {
    return this.adsService.syncFacebookBusinessToken(id, date);
  }

  @Get('costs')
  @Roles(Role.DIRECTOR, Role.OPS, Role.ACCOUNTING)
  async findAllCosts(@Query() query: QueryAdCostDto) {
    return this.adsService.findAllCosts(query);
  }

  @Post('costs')
  @Roles(Role.DIRECTOR)
  async createCost(@Body() dto: CreateAdCostDto) {
    return this.adsService.createOrUpdateCost(dto);
  }

  @Delete('costs/:id')
  @Roles(Role.DIRECTOR)
  async deleteCost(@Param('id', ParseMongoIdPipe) id: string) {
    await this.adsService.deleteCost(id);
    return { message: 'Đã xóa bản ghi chi phí' };
  }

  // ─── Sync ───────────────────────────────────────────────

  @Post('sync')
  @Roles(Role.DIRECTOR)
  async triggerSync() {
    return this.adsService.syncAllAdCosts();
  }

  @Post('sync/:accountId')
  @Roles(Role.DIRECTOR)
  async triggerSyncAccount(
    @Param('accountId', ParseMongoIdPipe) accountId: string,
    @Query('date') date?: string,
  ) {
    const synced = await this.adsService.syncAccountCosts(accountId, date);
    return { synced };
  }

  // ─── Analytics ──────────────────────────────────────────

  @Get('analytics')
  @Roles(Role.DIRECTOR, Role.OPS)
  async getAnalytics(@Query() query: QueryAdsAnalyticsDto) {
    return this.adsService.getAnalytics(
      query.startDate,
      query.endDate,
      query.adGroupId,
      query.platform,
    );
  }

  @Get('analytics/profit')
  @Roles(Role.DIRECTOR)
  async getNetProfitByAdGroup(@Query() query: QueryAdsProfitDto) {
    return this.adsService.getNetProfitByAdGroup(
      query.startDate,
      query.endDate,
      query.adGroupId,
    );
  }

  @Post('backfill-adgroup')
  @Roles(Role.DIRECTOR)
  async backfillAdGroupIds() {
    return this.adsService.backfillAdGroupIds();
  }

  @Get('suggestions')
  @Roles(Role.DIRECTOR)
  async getSuggestions(@Query() query: QueryAdsSuggestionsDto) {
    return this.adsService.getSuggestions(query.startDate, query.endDate, query.totalBudget);
  }
}
