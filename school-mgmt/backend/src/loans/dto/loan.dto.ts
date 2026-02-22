import { IsString, IsNotEmpty, IsNumber, Min, IsEnum, IsOptional, IsDateString, IsMongoId } from 'class-validator';
import { LenderType, LoanType, InterestType, PaymentFrequency } from '../schemas/loan.schema';

export class CreateLoanDto {
  @IsString() @IsNotEmpty()
  lenderName!: string;

  @IsEnum(LenderType)
  lenderType!: string;

  @IsEnum(LoanType)
  loanType!: string;

  @IsNumber() @Min(1)
  principal!: number;

  @IsNumber() @Min(0)
  interestRate!: number;

  @IsEnum(InterestType)
  interestType!: string;

  @IsNumber() @Min(1)
  term!: number;

  @IsDateString()
  startDate!: string;

  @IsEnum(PaymentFrequency)
  paymentFrequency!: string;

  @IsMongoId() @IsOptional()
  bankAccountId?: string;

  @IsString() @IsOptional()
  collateral?: string;

  @IsString() @IsOptional()
  notes?: string;
}

export class UpdateLoanDto {
  @IsString() @IsOptional()
  lenderName?: string;

  @IsEnum(LenderType) @IsOptional()
  lenderType?: string;

  @IsEnum(LoanType) @IsOptional()
  loanType?: string;

  @IsNumber() @Min(0) @IsOptional()
  interestRate?: number;

  @IsString() @IsOptional()
  collateral?: string;

  @IsString() @IsOptional()
  notes?: string;
}

export class RecordLoanPaymentDto {
  @IsMongoId()
  loanId!: string;

  @IsNumber() @Min(1)
  paymentNumber!: number;

  @IsDateString()
  paidDate!: string;

  @IsNumber() @Min(1) @IsOptional()
  amount?: number;

  @IsString() @IsOptional()
  paymentMethod?: string;

  @IsString() @IsOptional()
  reference?: string;

  @IsString() @IsOptional()
  notes?: string;
}

export class QueryLoanDto {
  @IsString() @IsOptional()
  keyword?: string;

  @IsString() @IsOptional()
  status?: string;

  @IsString() @IsOptional()
  lenderType?: string;

  @IsString() @IsOptional()
  loanType?: string;
}

export class QueryLoanPaymentDto {
  @IsMongoId() @IsOptional()
  loanId?: string;

  @IsString() @IsOptional()
  status?: string;

  @IsString() @IsOptional()
  startDate?: string;

  @IsString() @IsOptional()
  endDate?: string;
}
