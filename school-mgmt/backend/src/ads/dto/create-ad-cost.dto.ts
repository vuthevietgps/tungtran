import { IsString, IsNotEmpty, IsNumber, Min, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { AdPlatform } from '../schemas/ad-account.schema';
import { AdCostSource } from '../schemas/ad-cost.schema';

export class CreateAdCostDto {
  @IsString()
  @IsNotEmpty()
  adGroupId!: string;

  @IsString()
  @IsNotEmpty()
  adAccountId!: string;

  @IsEnum(AdPlatform)
  platform!: string;

  @IsDateString()
  date!: string;

  @IsNumber()
  @Min(0)
  spend!: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  impressions?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  clicks?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  conversions?: number;

  @IsEnum(AdCostSource)
  @IsOptional()
  source?: string;
}
