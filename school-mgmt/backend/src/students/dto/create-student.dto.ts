import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min, IsMongoId, IsIn } from 'class-validator';

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
  @IsIn([40, 50, 70, 90, 110, 120, 150])
  sessionDuration?: number;

  @IsOptional()
  @IsString()
  invoiceImage?: string;

  @IsOptional()
  @IsString()
  confirmStatus?: 'PENDING' | 'CONFIRMED';

  @IsOptional()
  @IsString()
  transferDate?: string;

  @IsOptional()
  @IsString()
  cod?: string;
}

export class CreateStudentDto {
  @IsOptional()
  @IsString()
  studentCode?: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsInt()
  @Min(3)
  @Max(60)
  age!: number;

  @IsString()
  @IsNotEmpty()
  parentName!: string;

  @IsString()
  @Matches(/^[0-9+\-()\s]{6,20}$/)
  parentPhone!: string;

  @IsOptional()
  @IsIn([40, 50, 70, 90, 110])
  registeredSessionDuration?: number;

  @IsString()
  faceImage!: string;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  productPackage?: string;

  @IsOptional()
  @IsString()
  studentType?: 'ONLINE' | 'OFFLINE';

  @IsOptional()
  @IsIn(['Đang học', 'Bảo lưu', 'Đã dừng học'])
  dataStatus?: 'Đang học' | 'Bảo lưu' | 'Đã dừng học';

  @IsOptional()
  @IsMongoId()
  saleId?: string;

  @IsOptional()
  @IsString()
  saleName?: string;

  @IsOptional()
  @IsString()
  trialOrGift?: string;

  @IsOptional()
  @IsString()
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsMongoId()
  approvedBy?: string;

  @IsOptional()
  payments?: PaymentFrameDto[];

}
