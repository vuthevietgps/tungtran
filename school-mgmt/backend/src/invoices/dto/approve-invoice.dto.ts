import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ApproveInvoiceDto {
  @IsEnum(['APPROVE', 'REJECT'])
  @IsNotEmpty()
  action!: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  rejectedReason?: string;
}
