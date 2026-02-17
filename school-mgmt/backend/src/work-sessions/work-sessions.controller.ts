import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';
import { WorkSessionsService } from './work-sessions.service';

@Controller('work-sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkSessionsController {
  constructor(private readonly workSessionsService: WorkSessionsService) {}

  /** Xem lịch sử chấm công (filter by user, date range) */
  @Get()
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS)
  findAll(
    @Query('userId') userId?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('status') status?: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.workSessionsService.findAll({ userId, fromDate, toDate, status, page, limit });
  }

  /** Nhân viên xem chấm công của mình */
  @Get('my')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS, Role.TEACHER, Role.SALE)
  findMy(
    @Req() req: AuthenticatedRequest,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.workSessionsService.findAll({
      userId: req.user.sub,
      fromDate,
      toDate,
      page,
      limit,
    });
  }

  /** Tổng hợp giờ làm theo tháng cho tất cả nhân viên */
  @Get('summary')
  @Roles(Role.DIRECTOR, Role.ACCOUNTING, Role.OPS)
  getMonthlySummary(
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
  ) {
    return this.workSessionsService.getMonthlySummary(
      new Date(periodStart),
      new Date(periodEnd),
    );
  }

  /** OPS/DIRECTOR chỉnh sửa thủ công (quên logout, sai giờ) */
  @Patch(':id')
  @Roles(Role.DIRECTOR, Role.OPS)
  update(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: { loginTime?: string; logoutTime?: string; notes?: string },
  ) {
    return this.workSessionsService.update(id, dto);
  }
}
