import { IsString, IsOptional, IsEnum } from 'class-validator';
import { LostReason } from '../schemas/lead.schema';

export class MarkLostDto {
  @IsEnum(LostReason)
  reason!: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
