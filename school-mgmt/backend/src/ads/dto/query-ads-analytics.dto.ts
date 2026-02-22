import { IsDateString, IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { AdPlatform } from '../schemas/ad-account.schema';

export class QueryAdsAnalyticsDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsMongoId()
  @IsOptional()
  adGroupId?: string;

  @IsEnum(AdPlatform)
  @IsOptional()
  platform?: string;
}
