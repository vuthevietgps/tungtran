import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(['ONLINE', 'OFFLINE'])
  @IsOptional()
  productType?: 'ONLINE' | 'OFFLINE';

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
