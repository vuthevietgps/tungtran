import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Hủy buổi học → CANCELLED
 * hoursBeforeSession / cancelPolicy sẽ xử lý trong service
 */
export class CancelSessionDto {
  @IsString()
  @IsNotEmpty()
  cancelReason!: string;
}
