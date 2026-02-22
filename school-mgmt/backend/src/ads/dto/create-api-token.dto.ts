import { IsString, IsNotEmpty, IsEnum, IsOptional, IsDateString, IsMongoId } from 'class-validator';
import { AdPlatform } from '../schemas/ad-account.schema';

export class CreateApiTokenDto {
  @IsString()
  @IsNotEmpty()
  @IsMongoId()
  adAccountId!: string;

  @IsEnum(AdPlatform)
  platform!: string;

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
