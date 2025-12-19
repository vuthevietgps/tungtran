import { IsOptional, IsString } from 'class-validator';

export class UpdatePaymentFrameDto {
  @IsOptional()
  @IsString()
  cod?: string;

  @IsOptional()
  @IsString()
  transferDate?: string;
}
