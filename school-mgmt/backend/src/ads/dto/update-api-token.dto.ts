import { IsString, IsEnum, IsOptional, IsDateString, IsMongoId } from 'class-validator';
import { ApiTokenStatus, ApiTokenType } from '../schemas/api-token.schema';

export class UpdateApiTokenDto {
  @IsMongoId()
  @IsOptional()
  adAccountId?: string;

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

  @IsEnum(ApiTokenType)
  @IsOptional()
  tokenType?: string;

  @IsString()
  @IsOptional()
  businessId?: string;

  @IsString()
  @IsOptional()
  businessName?: string;
}
