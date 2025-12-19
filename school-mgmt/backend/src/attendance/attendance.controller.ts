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
import { Request } from 'express';

@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // Điểm danh một học sinh
  @Post('mark')
  markAttendance(@Body() dto: CreateAttendanceDto, @Req() req: Request) {
    return this.attendanceService.markAttendance(dto, req.user as any);
  }

  // Điểm danh nhiều học sinh cùng lúc
  @Post('bulk-mark')
  bulkMarkAttendance(@Body() dto: BulkAttendanceDto, @Req() req: Request) {
    return this.attendanceService.bulkMarkAttendance(dto, req.user as any);
  }

  // Lấy danh sách điểm danh theo lớp và ngày
  @Get('class/:classId')
  getAttendanceByClass(
    @Param('classId') classId: string,
    @Query('date') date: string,
    @Req() req: Request
  ) {
    return this.attendanceService.getAttendanceByClass(classId, date, req.user as any);
  }

  // Lấy danh sách giáo viên của lớp
  @Get('class/:classId/teachers')
  getClassTeachers(@Param('classId') classId: string) {
    return this.attendanceService.getClassTeachers(classId);
  }

  // Lấy lịch sử điểm danh của một học sinh
  @Get('student/:studentId')
  getStudentAttendanceHistory(
    @Param('studentId') studentId: string,
    @Query('classId') classId?: string
  ) {
    return this.attendanceService.getStudentAttendanceHistory(studentId, classId);
  }

  // Cập nhật trạng thái điểm danh
  @Patch(':id')
  updateAttendance(
    @Param('id') id: string,
    @Body() dto: UpdateAttendanceDto,
    @Req() req: Request
  ) {
    return this.attendanceService.updateAttendance(id, dto, req.user as any);
  }

  // Thống kê điểm danh theo lớp
  @Get('stats/:classId')
  getAttendanceStats(
    @Param('classId') classId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Req() req: Request
  ) {
    return this.attendanceService.getAttendanceStats(classId, startDate, endDate, req.user as any);
  }

  @Get('teacher/classes')
  @Roles(Role.TEACHER)
  getTeacherClasses(@Req() req: Request) {
    return this.attendanceService.getTeacherClassAssignments(req.user as any);
  }

  @Get('order-classes')
  getOrderClasses(@Req() req: Request) {
    return this.attendanceService.getClassesFromOrders(req.user as any);
  }

  // Tạo link điểm danh cho học sinh
  @Post('generate-link')
  generateAttendanceLink(@Body() dto: GenerateAttendanceLinkDto, @Req() req: Request) {
    return this.attendanceService.generateAttendanceLink(dto, req.user as any);
  }

  // Lấy báo cáo điểm danh tổng hợp
  @Get('report')
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
export class PublicAttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // Lấy thông tin điểm danh từ token
  @Get('token/:token')
  getAttendanceByToken(@Param('token') token: string) {
    return this.attendanceService.getAttendanceByToken(token);
  }

  // Học sinh submit điểm danh
  @Post('submit')
  submitStudentAttendance(@Body() dto: StudentAttendanceDto) {
    return this.attendanceService.submitStudentAttendance(dto);
  }
}