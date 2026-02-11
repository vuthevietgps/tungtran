import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';
import { TransactionType, TransactionStatus } from '../schemas/ledger-entry.schema';

/**
 * Query ledger entries (lịch sử giao dịch)
 */
export class QueryLedgerDto {
  @IsMongoId()
  @IsOptional()
  userId?: string;

  @IsMongoId()
  @IsOptional()
  walletId?: string;

  @IsEnum(TransactionType)
  @IsOptional()
  type?: TransactionType;

  @IsEnum(TransactionStatus)
  @IsOptional()
  status?: TransactionStatus;

  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @IsDateString()
  @IsOptional()
  toDate?: string;

  @IsString()
  @IsOptional()
  sort?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
