import { 
  Body, 
  Controller, 
  Get, 
  Param, 
  Patch, 
  Post, 
  Query, 
  Req, 
  UseGuards 
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { CreateAttendanceDto, BulkAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { GenerateAttendanceLinkDto, StudentAttendanceDto } from './dto/generate-link.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { ParseMongoIdPipe } from '../common/pipes/parse-mongo-id.pipe';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // Điểm danh một học sinh
  @Post('mark')
  @Roles(Role.DIRECTOR, Role.OPS, Role.TEACHER)
  markAttendance(@Body() dto: CreateAttendanceDto, @Req() req: AuthenticatedRequest) {
    return this.attendanceService.markAttendance(dto, req.user);
  }

  // Điểm danh nhiều học sinh cùng lúc
  @Post('bulk-mark')
  @Roles(Role.DIRECTOR, Role.OPS, Role.TEACHER)
  bulkMarkAttendance(@Body() dto: BulkAttendanceDto, @Req() req: AuthenticatedRequest) {
    return this.attendanceService.bulkMarkAttendance(dto, req.user);
  }

  // Lấy danh sách điểm danh theo lớp và ngày
  @Get('class/:classId')
  @Roles(Role.DIRECTOR, Role.OPS, Role.TEACHER)
  getAttendanceByClass(
    @Param('classId', ParseMongoIdPipe) classId: string,
    @Query('date') date: string,
    @Req() req: AuthenticatedRequest
  ) {
    return this.attendanceService.getAttendanceByClass(classId, date, req.user);
  }

  // Lấy lịch sử điểm danh của một học sinh
  @Get('student/:studentId')
  @Roles(Role.DIRECTOR, Role.OPS, Role.TEACHER)
  getStudentAttendanceHistory(
    @Param('studentId', ParseMongoIdPipe) studentId: string,
    @Query('classId', ParseMongoIdPipe) classId?: string
  ) {
    return this.attendanceService.getStudentAttendanceHistory(studentId, classId);
  }

  // Cập nhật trạng thái điểm danh
  @Patch(':id')
  @Roles(Role.DIRECTOR, Role.OPS, Role.TEACHER)
  updateAttendance(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() dto: UpdateAttendanceDto,
    @Req() req: AuthenticatedRequest
  ) {
    return this.attendanceService.updateAttendance(id, dto, req.user);
  }

  // Thống kê điểm danh theo lớp
  @Get('stats/:classId')
  @Roles(Role.DIRECTOR, Role.OPS, Role.TEACHER)
  getAttendanceStats(
    @Param('classId', ParseMongoIdPipe) classId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: AuthenticatedRequest
  ) {
    return this.attendanceService.getAttendanceStats(classId, startDate, endDate, req.user);
  }

  @Get('teacher/classes')
  @Roles(Role.TEACHER)
  getTeacherClasses(@Req() req: AuthenticatedRequest) {
    return this.attendanceService.getTeacherClassAssignments(req.user);
  }

  @Get('classes-with-students')
  @Roles(Role.DIRECTOR, Role.OPS, Role.TEACHER)
  getClassesWithStudents(@Req() req: AuthenticatedRequest) {
    return this.attendanceService.getClassesWithStudents(req.user);
  }

  // Tạo link điểm danh cho học sinh
  @Post('generate-link')
  @Roles(Role.DIRECTOR, Role.OPS, Role.TEACHER)
  generateAttendanceLink(@Body() dto: GenerateAttendanceLinkDto, @Req() req: AuthenticatedRequest) {
    return this.attendanceService.generateAttendanceLink(dto, req.user);
  }

  // ── PARENT ENDPOINTS ─────────────────────────────────────────

  /** PH xem lịch sử điểm danh của tất cả con */
  @Get('my-children')
  @Roles(Role.PARENT)
  getChildrenAttendance(
    @Req() req: AuthenticatedRequest,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.attendanceService.getChildrenAttendance(req.user.sub, fromDate, toDate);
  }

  /** PH xem thống kê điểm danh tổng hợp của tất cả con */
  @Get('my-children/stats')
  @Roles(Role.PARENT)
  getChildrenAttendanceStats(@Req() req: AuthenticatedRequest) {
    return this.attendanceService.getChildrenAttendanceStats(req.user.sub);
  }

  // Lấy báo cáo điểm danh tổng hợp
  @Get('report')
  @Roles(Role.DIRECTOR, Role.OPS, Role.TEACHER)
  getAttendanceReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('classId') classId?: string
  ) {
    return this.attendanceService.getAttendanceReport(startDate, endDate, classId);
  }
}

// Controller riêng cho public endpoints (không cần authentication)
@Controller('public/attendance')
@UseGuards(ThrottlerGuard)
export class PublicAttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // Lấy thông tin điểm danh từ token
  @Get('token/:token')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  getAttendanceByToken(@Param('token') token: string) {
    return this.attendanceService.getAttendanceByToken(token);
  }

  // Học sinh submit điểm danh
  @Post('submit')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  submitStudentAttendance(@Body() dto: StudentAttendanceDto) {
    return this.attendanceService.submitStudentAttendance(dto);
  }
}