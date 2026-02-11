import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaymentMethod } from '../schemas/ledger-entry.schema';

/**
 * PH hoặc OPS yêu cầu nạp tiền vào ví.
 * Tạo LedgerEntry PENDING → ACCOUNTING duyệt → cộng balance.
 */
export class TopUpRequestDto {
  @IsMongoId()
  @IsNotEmpty()
  userId!: string; // Chủ ví (parentUserId)

  @IsNumber()
  @Min(1000)
  amount!: number; // Số tiền nạp (VNĐ)

  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  paymentMethod!: PaymentMethod;

  @IsString()
  @IsOptional()
  transactionRef?: string; // Mã giao dịch ngân hàng

  @IsString()
  @IsOptional()
  receiptImageUrl?: string; // Ảnh biên lai

  @IsString()
  @IsOptional()
  description?: string;
}
