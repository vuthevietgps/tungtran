import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ClassroomStatusService } from './classroom-status.service';
import { LockClassroomStatusDto } from './dto/update-classroom-status.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';

@Controller('classroom-status')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassroomStatusController {
  constructor(private readonly classroomStatusService: ClassroomStatusService) {}

  @Get()
  @Roles(Role.DIRECTOR, Role.SALE)
  findAll() {
    return this.classroomStatusService.findAll();
  }

  @Get(':id')
  @Roles(Role.DIRECTOR, Role.SALE)
  findOne(@Param('id') id: string) {
    return this.classroomStatusService.findOne(id);
  }

  @Patch(':id/lock')
  @Roles(Role.DIRECTOR)
  lock(@Param('id') id: string, @Body() dto: LockClassroomStatusDto) {
    return this.classroomStatusService.lock(id, dto);
  }
}
