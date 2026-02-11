import { PartialType } from '@nestjs/mapped-types';
import { CreateTeacherProfileDto } from './create-teacher-profile.dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TeacherStatus } from '../schemas/teacher-profile.schema';

export class UpdateTeacherProfileDto extends PartialType(CreateTeacherProfileDto) {
  @IsEnum(TeacherStatus)
  @IsOptional()
  status?: TeacherStatus;

  @IsString()
  @IsOptional()
  adminNotes?: string;
}
