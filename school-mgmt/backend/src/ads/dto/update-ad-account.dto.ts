import { IsString, IsNumber, Min, IsEnum, IsOptional } from 'class-validator';
import { AdAccountStatus } from '../schemas/ad-account.schema';

export class UpdateAdAccountDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  platformAccountId?: string;

  @IsEnum(AdAccountStatus)
  @IsOptional()
  status?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  monthlyBudget?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
