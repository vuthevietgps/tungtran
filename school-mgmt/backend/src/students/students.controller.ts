import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StudentsService } from './students.service';
import { StudentReportQueryDto } from './dto/student-report.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  @Roles(Role.DIRECTOR, Role.SALE)
  findAll() {
    return this.studentsService.findAll();
  }

  @Get('report')
  getStudentReport(@Query() query: StudentReportQueryDto) {
    return this.studentsService.getStudentReport(query.classId, query.searchTerm);
  }
}
