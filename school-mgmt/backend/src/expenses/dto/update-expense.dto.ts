import { IsString, IsNumber, Min, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ExpenseCategory } from '../schemas/expense.schema';

export class UpdateExpenseDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  amount?: number;

  @IsDateString()
  @IsOptional()
  expenseDate?: string;

  @IsEnum(ExpenseCategory)
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
