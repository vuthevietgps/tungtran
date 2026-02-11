import { IsOptional, IsString, IsEnum, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { LeadStatus, LeadSource } from '../schemas/lead.schema';

export class QueryLeadDto {
  @IsEnum(LeadStatus)
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  saleId?: string;

  @IsEnum(LeadSource)
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  fromDate?: string;

  @IsString()
  @IsOptional()
  toDate?: string;

  @IsString()
  @IsOptional()
  tag?: string;

  @IsString()
  @IsOptional()
  pool?: string;

  @IsString()
  @IsOptional()
  stale?: string;
}
