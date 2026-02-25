import { IsNotEmpty, IsString, IsOptional, IsNumber, IsArray, IsBoolean, IsEnum, Min, Max } from 'class-validator';
import { ProductCategory, TeachingMode } from '../schemas/product.schema';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ProductCategory)
  @IsOptional()
  category?: string;

  @IsEnum(TeachingMode)
  @IsOptional()
  teachingMode?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  defaultSessions?: number;

  @IsNumber()
  @Min(15)
  @IsOptional()
  defaultSessionDuration?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  pricePerSession?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  suggestedPrice?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  commissionRate?: number;

  @IsString()
  @IsOptional()
  gradeLevel?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  highlights?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
