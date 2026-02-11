import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SessionType } from '../schemas/session.schema';

class BulkSessionItem {
  @IsMongoId()
  @IsNotEmpty()
  studentId!: string;

  @IsMongoId()
  @IsOptional()
  parentUserId?: string;
}

/**
 * Tạo sessions hàng loạt cho 1 lớp, 1 ngày, nhiều học sinh
 * OPS hoặc GV có thể tạo nhanh lịch dạy cho cả lớp
 */
export class BulkCreateSessionDto {
  @IsMongoId()
  @IsNotEmpty()
  classId!: string;

  @IsMongoId()
  @IsNotEmpty()
  teacherId!: string;

  @IsDateString()
  @IsNotEmpty()
  scheduledDate!: string;

  @IsInt()
  @Min(15)
  @IsNotEmpty()
  durationMinutes!: number; // Thời lượng buổi học (phút) — bắt buộc

  @IsEnum(SessionType)
  @IsOptional()
  sessionType?: SessionType; // Loại buổi học, mặc định REGULAR

  // Giờ học linh hoạt — optional
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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkSessionItem)
  students!: BulkSessionItem[];
}
