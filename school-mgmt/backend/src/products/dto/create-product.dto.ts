import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(['ONLINE', 'OFFLINE'])
  productType!: 'ONLINE' | 'OFFLINE';

  @IsString()
  @IsOptional()
  teacherName?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  duration?: string;

  @IsString()
  @IsOptional()
  sessionCount?: string;
}
