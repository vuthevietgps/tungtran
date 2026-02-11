import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { QueryLeadDto } from './dto/query-lead.dto';
import { AddContactDto } from './dto/add-contact.dto';
import { MarkLostDto } from './dto/mark-lost.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';

@Controller('leads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR)
  create(@Body() dto: CreateLeadDto, @Req() req: AuthenticatedRequest) {
    return this.leadsService.create(dto, req.user);
  }

  @Get()
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR)
  findAll(@Query() query: QueryLeadDto, @Req() req: AuthenticatedRequest) {
    return this.leadsService.findAll(query, req.user);
  }

  @Get('pipeline')
  @Roles(Role.DIRECTOR, Role.OPS, Role.SALE)
  getPipeline(@Req() req: AuthenticatedRequest) {
    return this.leadsService.getPipeline(req.user);
  }

  @Get('stats')
  @Roles(Role.DIRECTOR)
  getStats(@Req() req: AuthenticatedRequest) {
    return this.leadsService.getStats(req.user);
  }

  @Get('follow-ups')
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR)
  getFollowUps(@Req() req: AuthenticatedRequest) {
    return this.leadsService.getFollowUps(req.user);
  }

  @Get('pool/list')
  @Roles(Role.OPS, Role.DIRECTOR)
  getPool() {
    return this.leadsService.getPool();
  }

  @Get(':id')
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR)
  findOne(@Param('id', ParseMongoIdPipe) id: string) {
    return this.leadsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR)
  update(@Param('id', ParseMongoIdPipe) id: string, @Body() dto: UpdateLeadDto, @Req() req: AuthenticatedRequest) {
    return this.leadsService.update(id, dto, req.user);
  }

  @Post(':id/contact')
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR)
  addContact(@Param('id', ParseMongoIdPipe) id: string, @Body() dto: AddContactDto, @Req() req: AuthenticatedRequest) {
    return this.leadsService.addContact(id, dto, req.user);
  }

  @Post(':id/convert')
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR)
  convert(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.leadsService.convert(id, req.user);
  }

  @Post(':id/lost')
  @Roles(Role.SALE, Role.OPS, Role.DIRECTOR)
  markLost(@Param('id', ParseMongoIdPipe) id: string, @Body() dto: MarkLostDto, @Req() req: AuthenticatedRequest) {
    return this.leadsService.markLost(id, dto, req.user);
  }

  @Post(':id/assign')
  @Roles(Role.OPS, Role.DIRECTOR)
  assign(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() body: { saleId: string; saleName: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.leadsService.assign(id, body.saleId, body.saleName, req.user);
  }

  @Post(':id/return-to-pool')
  @Roles(Role.OPS, Role.DIRECTOR)
  returnToPool(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() body: { reason: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.leadsService.returnToPool(id, body.reason, req.user);
  }

  @Delete(':id')
  @Roles(Role.DIRECTOR)
  remove(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.leadsService.remove(id, req.user);
  }
}
