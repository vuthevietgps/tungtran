import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { StudentsService } from './students.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/interfaces/role.enum';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import type { Express } from 'express';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Post()
  @Roles(Role.DIRECTOR, Role.SALE)
  create(@Body() dto: CreateStudentDto, @Req() req: Request) {
    return this.studentsService.create(dto, req.user as any);
  }

  @Get()
  @Roles(Role.DIRECTOR, Role.SALE)
  findAll(@Req() req: Request) {
    return this.studentsService.findAll(req.user as any);
  }

  @Patch(':id')
  @Roles(Role.DIRECTOR)
  update(@Param('id') id: string, @Body() dto: UpdateStudentDto) {
    return this.studentsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.DIRECTOR)
  remove(@Param('id') id: string) {
    return this.studentsService.remove(id);
  }

  @Post('face-upload')
  @Roles(Role.DIRECTOR, Role.SALE)
  @UseInterceptors(FileInterceptor('file'))
  uploadFace(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    if (!file) throw new BadRequestException('Image file is required');
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return { url: `${baseUrl}/uploads/students/${file.filename}` };
  }
}
