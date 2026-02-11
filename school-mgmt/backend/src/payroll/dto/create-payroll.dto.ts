import {
  IsDateString,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/**
 * Tạo bảng lương mới cho 1 GV trong kỳ (OPS/ACCOUNTING).
 * Service sẽ tự động pull sessions FINALIZED trong kỳ.
 */
export class CreatePayrollDto {
  @IsMongoId()
  @IsNotEmpty()
  teacherId!: string;

  @IsDateString()
  @IsNotEmpty()
  periodStart!: string;

  @IsDateString()
  @IsNotEmpty()
  periodEnd!: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  bonusAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  deductionAmount?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
