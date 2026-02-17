import { IsString, IsEnum, IsOptional } from 'class-validator';
import { AdPlatform, AdAccountStatus } from '../schemas/ad-account.schema';

export class QueryAdAccountDto {
  @IsEnum(AdPlatform)
  @IsOptional()
  platform?: string;

  @IsEnum(AdAccountStatus)
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
