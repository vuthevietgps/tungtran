import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

/**
 * Cập nhật thưởng/phạt/ghi chú cho payroll (trước khi submit).
 */
export class UpdatePayrollDto {
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
