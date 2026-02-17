import { IsString, IsNotEmpty, IsNumber, Min, IsEnum, IsOptional } from 'class-validator';
import { AdPlatform } from '../schemas/ad-account.schema';

export class CreateAdAccountDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(AdPlatform)
  platform!: string;

  @IsString()
  @IsNotEmpty()
  platformAccountId!: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  monthlyBudget?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
