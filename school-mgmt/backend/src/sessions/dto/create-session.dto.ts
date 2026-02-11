import {
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { SessionType } from '../schemas/session.schema';

export class CreateSessionDto {
  @IsMongoId()
  @IsNotEmpty()
  classId!: string;

  @IsMongoId()
  @IsNotEmpty()
  studentId!: string;

  @IsMongoId()
  @IsNotEmpty()
  teacherId!: string;

  @IsMongoId()
  @IsOptional()
  parentUserId?: string;

  // Loại buổi học
  @IsEnum(SessionType)
  @IsOptional()
  sessionType?: SessionType; // Mặc định REGULAR

  @IsDateString()
  @IsNotEmpty()
  scheduledDate!: string; // Ngày học (ISO date string)

  // Giờ học linh hoạt — GV & PH tự thỏa thuận, không bắt buộc
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'scheduledStartTime must be in HH:mm format',
  })
  scheduledStartTime?: string;

  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'scheduledEndTime must be in HH:mm format',
  })
  scheduledEndTime?: string;

  @IsInt()
  @Min(15)
  @IsNotEmpty()
  durationMinutes!: number; // Thời lượng buổi học (phút) — bắt buộc để tính tiền

  @IsInt()
  @Min(1)
  @IsOptional()
  sessionNumber?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  amountCharged?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  teacherPayout?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  autoConfirmAfterHours?: number;

  // Mục tiêu buổi học (có thể đặt trước khi dạy)
  @IsString()
  @IsOptional()
  lessonObjective?: string;
}
