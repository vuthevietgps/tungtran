import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min, IsMongoId } from 'class-validator';

export class PaymentFrameDto {
  @IsInt()
  @Min(1)
  @Max(10)
  frameIndex!: number; // 1..10

  @IsOptional()
  @IsString()
  invoiceCode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sessionsRegistered?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  pricePerSession?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  amountCollected?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sessionsCollected?: number;

  @IsOptional()
  @IsString()
  invoiceImage?: string;

  @IsOptional()
  @IsString()
  confirmStatus?: 'PENDING' | 'CONFIRMED';
}

export class CreateStudentDto {
  @IsString()
  @IsNotEmpty()
  studentCode!: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsInt()
  @Min(3)
  @Max(25)
  age!: number;

  @IsString()
  @IsNotEmpty()
  parentName!: string;

  @IsString()
  @Matches(/^[0-9+\-()\s]{6,20}$/)
  parentPhone!: string;

  @IsString()
  faceImage!: string;

  @IsOptional()
  @IsString()
  productPackage?: string;

  @IsOptional()
  @IsString()
  studentType?: 'ONLINE' | 'OFFLINE';

  @IsOptional()
  @IsMongoId()
  saleId?: string;

  @IsOptional()
  @IsString()
  saleName?: string;

  @IsOptional()
  @IsString()
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsMongoId()
  approvedBy?: string;

  @IsOptional()
  payments?: PaymentFrameDto[];

}
