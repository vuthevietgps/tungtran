import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { PaymentMethod } from '../schemas/expense.schema';

export class PayExpenseDto {
  @IsDateString()
  @IsOptional()
  paidAt?: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
