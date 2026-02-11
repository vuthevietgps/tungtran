import { IsString, IsOptional, IsEnum, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { ContactMethod } from '../schemas/lead.schema';

export class AddContactDto {
  @IsEnum(ContactMethod)
  method!: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  nextFollowUp?: string;
}
