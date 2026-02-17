import { IsString, IsOptional } from 'class-validator';

export class QueryMessageDto {
  @IsString()
  @IsOptional()
  page?: string;

  @IsString()
  @IsOptional()
  limit?: string;
}
