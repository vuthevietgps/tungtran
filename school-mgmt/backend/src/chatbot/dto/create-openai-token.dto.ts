import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class CreateOpenAITokenDto {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsString()
  @IsNotEmpty()
  apiKey!: string;

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
}
