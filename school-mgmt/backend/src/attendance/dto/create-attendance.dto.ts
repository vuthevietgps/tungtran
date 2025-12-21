import { IsArray, IsDateString, IsEnum, IsIn, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
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

  @IsString()
  @IsOptional()
  absenceProofImage?: string;

  @IsNumber()
  @IsOptional()
  @IsIn([40, 50, 70, 90, 110])
  sessionDuration?: number; // Độ dài buổi học (phút)

  @IsString()
  @IsOptional()
  sessionContent?: string;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsString()
  @IsOptional()
  recordLink?: string;

  @IsString()
  @IsOptional()
  parentConfirm?: string;

  @IsNumber()
  @IsOptional()
  paymentStatus?: number;

  @IsMongoId()
  @IsOptional()
  checkedBy?: string;
}

// DTO để điểm danh nhiều học sinh cùng lúc
export class BulkAttendanceDto {
  @IsMongoId()
  @IsNotEmpty()
  classId!: string;

  @IsMongoId()
  @IsOptional()
  teacherId?: string;

  @IsDateString()
  @IsNotEmpty()
  date!: string; // Format: YYYY-MM-DD

  @IsArray()
  @IsNotEmpty()
  attendances!: Array<{
    studentId: string;
    status: AttendanceStatus;
    notes?: string;
    absenceProofImage?: string;
    sessionDuration?: number;
  }>;

  @IsNumber()
  @IsOptional()
  @IsIn([40, 50, 70, 90, 110])
  sessionDuration?: number; // Độ dài mặc định áp dụng cho danh sách (nếu từng item không có)
}