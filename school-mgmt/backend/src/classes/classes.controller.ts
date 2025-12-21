import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { AssignStudentsDto } from './dto/assign-students.dto';
import { Request } from 'express';

@Controller('classes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Post()
  @Roles(Role.DIRECTOR)
  create(@Body() dto: CreateClassDto, @Req() req: Request) {
    return this.classesService.create(dto, req.user as any);
  }

  @Get()
  @Roles(Role.DIRECTOR, Role.SALE, Role.TEACHER)
  findAll(@Req() req: Request) {
    return this.classesService.findAll(req.user as any);
  }

  @Patch(':id')
  @Roles(Role.DIRECTOR, Role.SALE)
  update(@Param('id') id: string, @Body() dto: UpdateClassDto, @Req() req: Request) {
    return this.classesService.update(id, dto, req.user as any);
  }

  @Delete(':id')
  @Roles(Role.DIRECTOR)
  remove(@Param('id') id: string) {
    return this.classesService.remove(id);
  }
}
