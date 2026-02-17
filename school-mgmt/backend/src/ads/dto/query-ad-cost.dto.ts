import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { AdPlatform } from '../schemas/ad-account.schema';

export class QueryAdCostDto {
  @IsString()
  @IsOptional()
  adGroupId?: string;

  @IsString()
  @IsOptional()
  adAccountId?: string;

  @IsEnum(AdPlatform)
  @IsOptional()
  platform?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  page?: string;

  @IsString()
  @IsOptional()
  limit?: string;
}
