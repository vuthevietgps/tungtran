import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';

import { CreatePayrollDto } from './dto/create-payroll.dto';
import { QueryPayrollDto } from './dto/query-payroll.dto';
import { UpdatePayrollDto } from './dto/update-payroll.dto';
import { AdjustPayrollItemDto } from './dto/adjust-payroll-item.dto';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';

@Controller('payroll')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  // ── CREATE ──────────────────────────────────────────────────────

  /** Tạo bảng lương cho 1 GV */
  @Post()
  @Roles(Role.ACCOUNTING, Role.DIRECTOR)
  generate(@Body() dto: CreatePayrollDto, @Req() req: AuthenticatedRequest) {
    return this.payrollService.generate(dto, req.user.sub);
  }

  /** Tạo bảng lương hàng loạt cho tất cả GV */
  @Post('bulk-generate')
  @Roles(Role.ACCOUNTING, Role.DIRECTOR)
  bulkGenerate(
    @Body('periodStart') periodStart: string,
    @Body('periodEnd') periodEnd: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.payrollService.bulkGenerate(periodStart, periodEnd, req.user.sub);
  }

  // ── QUERY ───────────────────────────────────────────────────────

  /** Danh sách bảng lương (filter, paginate) */
  @Get()
  @Roles(Role.ACCOUNTING, Role.DIRECTOR, Role.OPS)
  findAll(@Query() query: QueryPayrollDto) {
    return this.payrollService.findAll(query);
  }

  /** Tổng hợp payroll theo status */
  @Get('summary')
  @Roles(Role.ACCOUNTING, Role.DIRECTOR)
  getSummary() {
    return this.payrollService.getPayrollSummary();
  }

  /** Preview lương GV chi tiết — phân loại sessions */
  @Get('teacher-preview')
  @Roles(Role.ACCOUNTING, Role.DIRECTOR, Role.OPS, Role.TEACHER)
  getTeacherPreview(
    @Query('teacherId') teacherId: string,
    @Query('periodStart') periodStart: string,
    @Query('periodEnd') periodEnd: string,
    @Req() req: AuthenticatedRequest,
  ) {
    // Teachers can only preview their own payroll
    const effectiveTeacherId =
      req.user.role === Role.TEACHER ? req.user.sub : teacherId;
    if (!effectiveTeacherId) {
      throw new BadRequestException('teacherId is required');
    }
    return this.payrollService.getTeacherPayrollPreview(
      effectiveTeacherId,
      periodStart,
      periodEnd,
    );
  }

  /** GV xem bảng lương của mình */
  @Get('my-payroll')
  @Roles(Role.TEACHER)
  getMyPayroll(@Req() req: AuthenticatedRequest, @Query() query: QueryPayrollDto) {
    return this.payrollService.findAll({ ...query, teacherId: req.user.sub });
  }

  /** Chi tiết bảng lương */
  @Get(':id')
  @Roles(Role.ACCOUNTING, Role.DIRECTOR, Role.OPS, Role.TEACHER)
  findOne(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.payrollService.findById(id, req.user);
  }

  /** Danh sách items (các buổi dạy) trong bảng lương */
  @Get(':id/items')
  @Roles(Role.ACCOUNTING, Role.DIRECTOR, Role.OPS, Role.TEACHER)
  getItems(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.payrollService.getPayrollItems(id, req.user);
  }

  // ── UPDATE ──────────────────────────────────────────────────────

  /** Cập nhật thưởng/phạt/ghi chú (chỉ DRAFT) */
  @Patch(':id')
  @Roles(Role.ACCOUNTING, Role.DIRECTOR)
  update(@Param('id', ParseMongoIdPipe) id: string, @Body() dto: UpdatePayrollDto) {
    return this.payrollService.update(id, dto);
  }

  /** Điều chỉnh 1 item trong bảng lương */
  @Patch(':id/items/:itemId')
  @Roles(Role.ACCOUNTING, Role.DIRECTOR)
  adjustItem(
    @Param('id', ParseMongoIdPipe) id: string,
    @Param('itemId', ParseMongoIdPipe) itemId: string,
    @Body() dto: AdjustPayrollItemDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.payrollService.adjustItem(id, itemId, dto, req.user.sub);
  }

  // ── WORKFLOW ────────────────────────────────────────────────────

  /** Submit bảng lương để DIRECTOR duyệt */
  @Post(':id/submit')
  @Roles(Role.ACCOUNTING, Role.OPS)
  submitForReview(@Param('id', ParseMongoIdPipe) id: string) {
    return this.payrollService.submitForReview(id);
  }

  /** DIRECTOR phê duyệt bảng lương */
  @Post(':id/approve')
  @Roles(Role.DIRECTOR)
  approve(@Param('id', ParseMongoIdPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.payrollService.approve(id, req.user.sub);
  }

  /** DIRECTOR từ chối bảng lương */
  @Post(':id/reject')
  @Roles(Role.DIRECTOR)
  reject(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body('reason') reason: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.payrollService.reject(id, req.user.sub, reason);
  }

  /** Mở lại bảng lương bị từ chối */
  @Post(':id/reopen')
  @Roles(Role.ACCOUNTING, Role.DIRECTOR)
  reopen(@Param('id', ParseMongoIdPipe) id: string) {
    return this.payrollService.reopen(id);
  }

  /** Xác nhận đã chi lương → PAID. Truyền bankAccountId để ghi BankTransaction (BUG #3 fix) */
  @Post(':id/mark-paid')
  @Roles(Role.ACCOUNTING, Role.DIRECTOR)
  markPaid(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() body: { paymentRef?: string; bankAccountId?: string },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.payrollService.markPaid(
      id,
      req.user.sub,
      body.paymentRef,
      body.bankAccountId,
      req.user.fullName,
    );
  }

  // ── DELETE ──────────────────────────────────────────────────────

  /** Xóa bảng lương DRAFT */
  @Delete(':id')
  @Roles(Role.ACCOUNTING, Role.DIRECTOR)
  remove(@Param('id', ParseMongoIdPipe) id: string) {
    return this.payrollService.remove(id);
  }
}
