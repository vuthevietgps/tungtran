import { IsNotEmpty, IsNumber, IsOptional, IsString, IsDateString, Min } from 'class-validator';

export class CreateInvoiceDto {
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsString()
  @IsNotEmpty()
  studentId!: string;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsDateString()
  paymentDate!: string;

  @IsString()
  @IsNotEmpty()
  receiptImage!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  status?: string;
}