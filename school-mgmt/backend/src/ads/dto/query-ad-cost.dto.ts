import { IsString, IsEnum, IsOptional, IsDateString, IsMongoId } from 'class-validator';
import { AdPlatform } from '../schemas/ad-account.schema';

export class QueryAdCostDto {
  @IsString()
  @IsOptional()
  @IsMongoId()
  adGroupId?: string;

  @IsString()
  @IsOptional()
  @IsMongoId()
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
