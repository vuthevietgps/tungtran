import { IsString, IsNotEmpty, IsNumber, Min, IsOptional, IsEnum } from 'class-validator';
import { FundType } from '../schemas/fund.schema';
import { FundTransactionType } from '../schemas/fund-transaction.schema';

export class CreateFundDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(FundType)
  fundType!: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minimumBalance?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  targetBalance?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  currentBalance?: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateFundDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  minimumBalance?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  targetBalance?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  status?: string;
}

export class FundTransactionDto {
  @IsString()
  @IsNotEmpty()
  fundId!: string;

  @IsEnum(FundTransactionType)
  @IsNotEmpty()
  type!: string; // DEPOSIT | WITHDRAW | ADJUSTMENT

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  transactionDate!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  reference?: string;
}

export class QueryFundTransactionDto {
  @IsString()
  @IsOptional()
  fundId?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;
}

export class QueryCashFlowDto {
  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  groupBy?: string; // 'day' | 'week' | 'month'
}
