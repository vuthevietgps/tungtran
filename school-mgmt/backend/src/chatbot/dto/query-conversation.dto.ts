import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ConversationStatus } from '../schemas/conversation.schema';
import { FanpagePlatform } from '../schemas/fanpage.schema';

export class QueryConversationDto {
  @IsString()
  @IsOptional()
  fanpageId?: string;

  @IsEnum(ConversationStatus)
  @IsOptional()
  status?: string;

  @IsEnum(FanpagePlatform)
  @IsOptional()
  platform?: string;

  @IsString()
  @IsOptional()
  assignedAgentId?: string;

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
