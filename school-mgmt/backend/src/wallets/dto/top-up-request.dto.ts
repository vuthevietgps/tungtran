import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateIf,
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

  @ValidateIf((o: TopUpRequestDto) => o.paymentMethod === PaymentMethod.BANK_TRANSFER)
  @IsString()
  @Matches(/^(https?:\/\/|\/uploads\/|data:image\/)/, {
    message: 'receiptImageUrl must be URL, /uploads path, or base64 image',
  })
  receiptImageUrl?: string; // Ảnh biên lai

  @IsString()
  @IsOptional()
  description?: string;
}
