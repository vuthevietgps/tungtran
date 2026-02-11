import {
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
} from 'class-validator';

/**
 * ACCOUNTING/DIRECTOR điều chỉnh số dư thủ công (cộng hoặc trừ).
 */
export class AdjustBalanceDto {
  @IsMongoId()
  @IsNotEmpty()
  userId!: string; // Chủ ví

  @IsNumber()
  @Min(0)
  amount!: number; // Số tiền điều chỉnh (VNĐ)

  @IsIn(['ADD', 'SUBTRACT'])
  direction!: 'ADD' | 'SUBTRACT'; // Cộng / Trừ

  @IsString()
  @IsNotEmpty()
  description!: string; // Lý do điều chỉnh (bắt buộc)
}
