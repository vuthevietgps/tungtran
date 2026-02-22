import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsDateString,
  IsMongoId,
} from 'class-validator';
import { BankAccountStatus } from '../schemas/bank-account.schema';
import { BankTransactionType, BankTransactionCategory } from '../schemas/bank-transaction.schema';

export class CreateBankAccountDto {
  @IsString()
  @IsNotEmpty()
  bankName!: string;

  @IsString()
  @IsNotEmpty()
  accountNumber!: string;

  @IsString()
  @IsOptional()
  accountHolder?: string;

  @IsString()
  @IsOptional()
  branch?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  openingBalance?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;
}

export class UpdateBankAccountDto {
  @IsString()
  @IsOptional()
  bankName?: string;

  @IsString()
  @IsOptional()
  accountNumber?: string;

  @IsString()
  @IsOptional()
  accountHolder?: string;

  @IsString()
  @IsOptional()
  branch?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean;

  @IsEnum(BankAccountStatus)
  @IsOptional()
  status?: string;
}

export class RecordBankTransactionDto {
  @IsMongoId()
  @IsNotEmpty()
  bankAccountId!: string;

  @IsEnum(BankTransactionType)
  @IsNotEmpty()
  type!: string;

  @IsEnum(BankTransactionCategory)
  @IsOptional()
  category?: string;

  @IsNumber()
  @Min(1)
  amount!: number;

  @IsDateString()
  @IsNotEmpty()
  transactionDate!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsMongoId()
  @IsOptional()
  referenceId?: string;

  @IsString()
  @IsOptional()
  referenceType?: string;
}

export class QueryBankTransactionDto {
  @IsMongoId()
  @IsOptional()
  bankAccountId?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  keyword?: string;
}
