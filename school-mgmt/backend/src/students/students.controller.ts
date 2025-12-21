import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { StudentReportQueryDto } from './dto/student-report.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { multerConfig } from '../common/config/multer.config';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @Roles(Role.DIRECTOR, Role.MANAGER, Role.SALE)
  findAll() {
    return this.studentsService.findAll();
  }

  @Get('pending')
  @Roles(Role.DIRECTOR, Role.MANAGER, Role.SALE)
  findPendingApproval() {
    return this.studentsService.findPendingApproval();
  }

  @Get('report')
  @Roles(Role.DIRECTOR, Role.MANAGER, Role.SALE)
  getStudentReport(@Query() query: StudentReportQueryDto) {
    return this.studentsService.getStudentReport(query.classId, query.searchTerm);
  }

  @Post()
  @Roles(Role.DIRECTOR, Role.MANAGER, Role.SALE)
  create(@Body() createStudentDto: CreateStudentDto, @Req() req: any) {
    return this.studentsService.create(createStudentDto, req.user);
  }

  @Get(':id')
  @Roles(Role.DIRECTOR, Role.MANAGER, Role.SALE)
  findOne(@Param('id') id: string) {
    return this.studentsService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.DIRECTOR, Role.MANAGER, Role.SALE)
  update(@Param('id') id: string, @Body() updateStudentDto: UpdateStudentDto) {
    return this.studentsService.update(id, updateStudentDto);
  }

  @Delete('clear-all')
  @Roles(Role.DIRECTOR, Role.MANAGER, Role.SALE)
  clearAllData() {
    return this.studentsService.clearAllStudentData();
  }

  @Delete(':id')
  @Roles(Role.DIRECTOR, Role.MANAGER, Role.SALE)
  remove(@Param('id') id: string) {
    return this.studentsService.remove(id);
  }

  @Post('face-upload')
  @UseInterceptors(FileInterceptor('file', multerConfig))
  @Roles(Role.DIRECTOR, Role.MANAGER, Role.SALE)
  async uploadFace(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) {
      throw new Error('No file uploaded');
    }
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return { url: `${baseUrl}/uploads/students/${file.filename}` };
  }

  @Post(':id/approve')
  @Roles(Role.DIRECTOR, Role.MANAGER, Role.SALE)
  async approve(@Param('id') id: string, @Body() body: { action: 'APPROVE' | 'REJECT'; userId: string }) {
    return this.studentsService.approve(id, body.action, body.userId);
  }
}
