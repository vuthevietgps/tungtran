import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiTokenStatus } from '../schemas/api-token.schema';

export class UpdateApiTokenDto {
  @IsString()
  @IsOptional()
  accessToken?: string;

  @IsString()
  @IsOptional()
  refreshToken?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @IsEnum(ApiTokenStatus)
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  label?: string;
}
