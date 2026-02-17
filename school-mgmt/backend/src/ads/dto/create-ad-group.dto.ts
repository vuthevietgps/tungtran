import { IsString, IsNotEmpty, IsNumber, Min, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { AdPlatform } from '../schemas/ad-account.schema';

export class CreateAdGroupDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  adAccountId!: string;

  @IsEnum(AdPlatform)
  platform!: string;

  @IsString()
  @IsNotEmpty()
  platformCampaignId!: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  dailyBudget?: number;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  targetAudience?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
