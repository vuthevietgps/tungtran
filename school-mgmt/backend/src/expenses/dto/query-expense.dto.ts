import { IsOptional, IsString, IsEnum, IsNumberString } from 'class-validator';
import { ExpenseCategory, PaymentStatus } from '../schemas/expense.schema';

export class QueryExpenseDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: string;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  createdById?: string;

  @IsOptional()
  @IsNumberString()
  page?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;
}
