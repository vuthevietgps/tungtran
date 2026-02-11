import { IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class TransferDto {
  /** UserId nguồn (ví gửi) */
  @IsMongoId()
  @IsNotEmpty()
  fromUserId!: string;

  /** UserId đích (ví nhận) */
  @IsMongoId()
  @IsNotEmpty()
  toUserId!: string;

  /** Số tiền chuyển (VNĐ) — không phí */
  @IsNumber()
  @Min(1000)
  amount!: number;

  /** Lý do chuyển */
  @IsOptional()
  @IsString()
  description?: string;
}
