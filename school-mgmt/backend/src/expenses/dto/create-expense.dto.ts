import { IsString, IsNotEmpty, IsNumber, Min, IsEnum, IsOptional, IsDateString, IsBoolean } from 'class-validator';
import { ExpenseCategory, RecurringFrequency } from '../schemas/expense.schema';

export class CreateExpenseDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsDateString()
  expenseDate!: string;

  @IsEnum(ExpenseCategory)
  category!: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @IsEnum(RecurringFrequency)
  @IsOptional()
  recurringFrequency?: string;

  @IsDateString()
  @IsOptional()
  recurringStartDate?: string;

  @IsDateString()
  @IsOptional()
  recurringEndDate?: string;
}
