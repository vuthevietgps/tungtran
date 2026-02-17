import { IsString, IsOptional, IsNumber, Min, Max, IsEnum } from 'class-validator';
import { OpenAITokenStatus } from '../schemas/openai-token.schema';

export class UpdateOpenAITokenDto {
  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  @IsOptional()
  apiKey?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsNumber()
  @Min(0)
  @Max(2)
  @IsOptional()
  temperature?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  maxTokens?: number;

  @IsString()
  @IsOptional()
  systemPromptPrefix?: string;

  @IsEnum(OpenAITokenStatus)
  @IsOptional()
  status?: string;
}
