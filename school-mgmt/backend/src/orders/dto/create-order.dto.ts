import { IsEmail, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateOrderDto {
  @IsOptional()
  @IsMongoId()
  studentId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  studentName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  studentCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  level?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  parentName!: string;

  @IsOptional()
  @IsMongoId()
  teacherId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  teacherName?: string;

  @IsOptional()
  @IsEmail()
  teacherEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  teacherCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  teacherSalary?: number;

  @IsOptional()
  @IsMongoId()
  saleId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  saleName?: string;

  @IsOptional()
  @IsEmail()
  saleEmail?: string;

  @IsOptional()
  @IsMongoId()
  classId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  classCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  invoiceNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sessionsByInvoice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  dataStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  trialOrGift?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  paymentInvoiceCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  paymentProofImage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  status?: string;
}
