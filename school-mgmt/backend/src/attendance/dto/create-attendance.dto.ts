import { IsArray, IsDateString, IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceStatus } from '../schemas/attendance.schema';

export class CreateAttendanceDto {
  @IsMongoId()
  @IsNotEmpty()
  classId!: string;

  @IsMongoId()
  @IsNotEmpty()
  studentId!: string;

  @IsDateString()
  @IsNotEmpty()
  date!: string; // Format: YYYY-MM-DD

  @IsEnum(AttendanceStatus)
  @IsOptional()
  status?: AttendanceStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}

// DTO for nested attendance item
class AttendanceItemDto {
  @IsMongoId()
  @IsNotEmpty()
  studentId!: string;

  @IsEnum(AttendanceStatus)
  @IsNotEmpty()
  status!: AttendanceStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}

// DTO để điểm danh nhiều học sinh cùng lúc
export class BulkAttendanceDto {
  @IsMongoId()
  @IsNotEmpty()
  classId!: string;

  @IsDateString()
  @IsNotEmpty()
  date!: string; // Format: YYYY-MM-DD

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceItemDto)
  @IsNotEmpty()
  attendances!: AttendanceItemDto[];
}