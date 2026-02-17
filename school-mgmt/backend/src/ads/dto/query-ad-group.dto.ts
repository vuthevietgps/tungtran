import { IsString, IsEnum, IsOptional } from 'class-validator';
import { AdPlatform } from '../schemas/ad-account.schema';
import { AdGroupStatus } from '../schemas/ad-group.schema';

export class QueryAdGroupDto {
  @IsString()
  @IsOptional()
  adAccountId?: string;

  @IsEnum(AdPlatform)
  @IsOptional()
  platform?: string;

  @IsEnum(AdGroupStatus)
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  page?: string;

  @IsString()
  @IsOptional()
  limit?: string;
}
