import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { FanpageStatus } from '../schemas/fanpage.schema';

export class UpdateFanpageDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  pageId?: string;

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

  @IsEnum(FanpageStatus)
  @IsOptional()
  status?: string;
}
