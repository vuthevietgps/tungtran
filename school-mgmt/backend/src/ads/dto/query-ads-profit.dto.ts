import { IsDateString, IsMongoId, IsOptional } from 'class-validator';

export class QueryAdsProfitDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsMongoId()
  @IsOptional()
  adGroupId?: string;
}
