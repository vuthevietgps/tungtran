import { IsString, IsNotEmpty, IsEnum, IsOptional, IsDateString, IsMongoId } from 'class-validator';
import { AdPlatform } from '../schemas/ad-account.schema';
import { ApiTokenType } from '../schemas/api-token.schema';

export class CreateApiTokenDto {
  @IsString()
  @IsMongoId()
  @IsOptional()
  adAccountId?: string;

  @IsEnum(AdPlatform)
  platform!: string;

  @IsEnum(ApiTokenType)
  @IsOptional()
  tokenType?: string;

  @IsString()
  @IsOptional()
  businessId?: string;

  @IsString()
  @IsOptional()
  businessName?: string;

  @IsString()
  @IsNotEmpty()
  accessToken!: string;

  @IsString()
  @IsOptional()
  refreshToken?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @IsString()
  @IsOptional()
  label?: string;
}
