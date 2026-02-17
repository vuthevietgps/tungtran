import { IsString, IsNotEmpty, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { FanpagePlatform } from '../schemas/fanpage.schema';

export class CreateFanpageDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(FanpagePlatform)
  platform!: string;

  @IsString()
  @IsNotEmpty()
  pageId!: string;

  @IsString()
  @IsOptional()
  pageAccessToken?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  adAccountId?: string;

  @IsString()
  @IsOptional()
  webhookVerifyToken?: string;

  @IsString()
  @IsOptional()
  appSecret?: string;

  @IsString()
  @IsOptional()
  openaiTokenId?: string;

  @IsBoolean()
  @IsOptional()
  aiAutoReplyEnabled?: boolean;
}
