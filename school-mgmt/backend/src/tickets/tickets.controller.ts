import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';

import { CreateTicketDto } from './dto/create-ticket.dto';
import { QueryTicketDto } from './dto/query-ticket.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { ResolveTicketDto } from './dto/resolve-ticket.dto';

@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // ── CREATE ──────────────────────────────────────────────────────

  /** PH/GV/OPS tạo ticket */
  @Post()
  @Roles(Role.PARENT, Role.TEACHER, Role.OPS, Role.DIRECTOR, Role.ACCOUNTING)
  create(@Body() dto: CreateTicketDto, @Req() req: AuthenticatedRequest) {
    return this.ticketsService.create(dto, req.user.sub, req.user.role);
  }

  // ── QUERY ───────────────────────────────────────────────────────

  /** Danh sách tickets (OPS/DIRECTOR xem tất cả) */
  @Get()
  @Roles(Role.OPS, Role.DIRECTOR, Role.ACCOUNTING)
  findAll(@Query() query: QueryTicketDto) {
    return this.ticketsService.findAll(query);
  }

  /** Thống kê tickets */
  @Get('stats')
  @Roles(Role.OPS, Role.DIRECTOR)
  getStats() {
    return this.ticketsService.getStats();
  }

  /** PH xem tickets của mình */
  @Get('my-tickets')
  @Roles(Role.PARENT, Role.TEACHER, Role.ACCOUNTING)
  getMyTickets(@Req() req: AuthenticatedRequest, @Query() query: QueryTicketDto) {
    return this.ticketsService.findMyTickets(req.user.sub, query);
  }

  /** OPS xem tickets được assign cho mình */
  @Get('assigned-to-me')
  @Roles(Role.OPS)
  getAssignedToMe(@Req() req: AuthenticatedRequest, @Query() query: QueryTicketDto) {
    return this.ticketsService.findAll({ ...query, assignedTo: req.user.sub });
  }

  /** Chi tiết ticket */
  @Get(':id')
  @Roles(Role.OPS, Role.DIRECTOR, Role.ACCOUNTING, Role.PARENT, Role.TEACHER)
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.ticketsService.findById(id, req.user);
  }

  // ── UPDATE ──────────────────────────────────────────────────────

  /** Cập nhật priority / assign */
  @Patch(':id')
  @Roles(Role.OPS, Role.DIRECTOR)
  update(@Param('id') id: string, @Body() dto: UpdateTicketDto) {
    return this.ticketsService.update(id, dto);
  }

  // ── COMMENTS ────────────────────────────────────────────────────

  /** Thêm comment */
  @Post(':id/comments')
  @Roles(Role.OPS, Role.DIRECTOR, Role.PARENT, Role.TEACHER, Role.ACCOUNTING)
  addComment(
    @Param('id') id: string,
    @Body() dto: AddCommentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ticketsService.addComment(id, req.user.sub, dto, req.user);
  }

  /** Xem comments (OPS/DIRECTOR thấy internal, PH/GV không thấy) */
  @Get(':id/comments')
  @Roles(Role.OPS, Role.DIRECTOR, Role.PARENT, Role.TEACHER, Role.ACCOUNTING)
  getComments(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const includeInternal = [Role.OPS, Role.DIRECTOR].includes(req.user.role);
    return this.ticketsService.getComments(id, includeInternal, req.user);
  }

  // ── WORKFLOW ────────────────────────────────────────────────────

  /** OPS nhận xử lý */
  @Post(':id/start')
  @Roles(Role.OPS, Role.DIRECTOR)
  startProcessing(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.ticketsService.startProcessing(id, req.user.sub);
  }

  /** Yêu cầu thêm thông tin */
  @Post(':id/request-info')
  @Roles(Role.OPS, Role.DIRECTOR)
  requestInfo(@Param('id') id: string) {
    return this.ticketsService.requestInfo(id);
  }

  /** Giải quyết ticket (có thể kèm hoàn tiền) */
  @Post(':id/resolve')
  @Roles(Role.OPS, Role.DIRECTOR)
  resolve(
    @Param('id') id: string,
    @Body() dto: ResolveTicketDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ticketsService.resolve(id, req.user.sub, dto);
  }

  /** Đóng ticket */
  @Post(':id/close')
  @Roles(Role.OPS, Role.DIRECTOR)
  close(@Param('id') id: string) {
    return this.ticketsService.close(id);
  }

  /** Người tạo hủy ticket */
  @Post(':id/cancel')
  @Roles(Role.PARENT, Role.TEACHER, Role.OPS)
  cancel(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.ticketsService.cancel(id, req.user.sub);
  }

  /** Mở lại ticket đã giải quyết */
  @Post(':id/reopen')
  @Roles(Role.OPS, Role.DIRECTOR)
  reopen(@Param('id') id: string) {
    return this.ticketsService.reopen(id);
  }
}
