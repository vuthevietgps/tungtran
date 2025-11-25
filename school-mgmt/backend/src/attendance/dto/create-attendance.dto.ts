import { IsArray, IsDateString, IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
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

// DTO để điểm danh nhiều học sinh cùng lúc
export class BulkAttendanceDto {
  @IsMongoId()
  @IsNotEmpty()
  classId!: string;

  @IsDateString()
  @IsNotEmpty()
  date!: string; // Format: YYYY-MM-DD

  @IsArray()
  @IsNotEmpty()
  attendances!: Array<{
    studentId: string;
    status: AttendanceStatus;
    notes?: string;
  }>;
}