import { IsString, IsOptional } from 'class-validator';

export class ApproveExpenseDto {
  @IsString()
  @IsOptional()
  rejectionReason?: string;
}
