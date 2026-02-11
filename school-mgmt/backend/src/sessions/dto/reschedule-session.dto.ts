import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

/**
 * Dời lịch buổi học → buổi cũ RESCHEDULED, tạo buổi mới SCHEDULED
 * Giờ học linh hoạt — GV & PH tự thỏa thuận
 */
export class RescheduleSessionDto {
  @IsDateString()
  @IsNotEmpty()
  newScheduledDate!: string;

  @IsInt()
  @Min(15)
  @IsOptional()
  durationMinutes?: number; // Thay đổi thời lượng nếu cần

  // Giờ học linh hoạt — optional
  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'newStartTime must be in HH:mm format',
  })
  newStartTime?: string;

  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'newEndTime must be in HH:mm format',
  })
  newEndTime?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}
