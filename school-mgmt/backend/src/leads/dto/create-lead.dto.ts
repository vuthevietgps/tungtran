import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, IsEnum, IsDate, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { LeadSource } from '../schemas/lead.schema';

export class CreateLeadDto {
  @IsString()
  @IsNotEmpty()
  parentName!: string;

  @IsString()
  @IsNotEmpty()
  parentPhone!: string;

  @IsString()
  @IsOptional()
  parentEmail?: string;

  @IsString()
  @IsOptional()
  studentName?: string;

  @IsString()
  @IsOptional()
  studentGrade?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  interestedSubjects?: string[];

  @IsEnum(LeadSource)
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  referredBy?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  estimatedValue?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  notes?: string;
}
