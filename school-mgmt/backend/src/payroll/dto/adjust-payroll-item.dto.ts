import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PayrollItemStatus } from '../schemas/payroll.schema';

/**
 * Điều chỉnh 1 item trong bảng lương (trước khi submit review).
 */
export class AdjustPayrollItemDto {
  @IsNumber()
  @Min(0)
  adjustedPayout!: number;

  @IsString()
  @IsOptional()
  adjustmentReason?: string;

  @IsEnum(PayrollItemStatus)
  @IsOptional()
  status?: PayrollItemStatus;
}
