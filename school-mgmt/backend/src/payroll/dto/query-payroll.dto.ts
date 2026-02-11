import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';
import { PayrollStatus } from '../schemas/payroll.schema';

export class QueryPayrollDto {
  @IsMongoId()
  @IsOptional()
  teacherId?: string;

  @IsEnum(PayrollStatus)
  @IsOptional()
  status?: PayrollStatus;

  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @IsDateString()
  @IsOptional()
  toDate?: string;

  @IsString()
  @IsOptional()
  sort?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
