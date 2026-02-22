import { IsString, IsEnum, IsOptional, IsDateString, IsMongoId } from 'class-validator';
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

  /**
   * BUG #2 fix: Tùy chọn chỉ định tài khoản ngân hàng để ghi nhận giao dịch.
   * Nếu paymentMethod = BANK_TRANSFER và không cung cấp, dùng tài khoản chính.
   * Nếu cung cấp bankAccountId (kể cả khi dùng CASH), hệ thống ghi nhận outflow ngân hàng.
   */
  @IsMongoId()
  @IsOptional()
  bankAccountId?: string;
}
