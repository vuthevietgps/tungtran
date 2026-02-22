import { Type } from 'class-transformer';
import { IsDateString, IsNumber, Min } from 'class-validator';

export class QueryAdsSuggestionsDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalBudget!: number;
}
