import { IsString, IsEnum, IsOptional } from 'class-validator';
import { FanpagePlatform, FanpageStatus } from '../schemas/fanpage.schema';

export class QueryFanpageDto {
  @IsEnum(FanpagePlatform)
  @IsOptional()
  platform?: string;

  @IsEnum(FanpageStatus)
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
