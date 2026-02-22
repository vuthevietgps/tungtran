import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsEnum,
  IsIn,
  IsDateString,
  IsMongoId,
} from 'class-validator';
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
  @IsMongoId()
  @IsNotEmpty()
  fundId!: string;

  @IsEnum(FundTransactionType)
  @IsNotEmpty()
  type!: string; // DEPOSIT | WITHDRAW | ADJUSTMENT

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
}

export class QueryFundTransactionDto {
  @IsMongoId()
  @IsOptional()
  fundId?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}

export class QueryCashFlowDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy?: string; // 'day' | 'week' | 'month'

  @IsString()
  @IsOptional()
  @IsIn(['cash', 'accrual'])
  basis?: string; // currently cash-flow totals are cash-based; accrual is reference metadata only
}
