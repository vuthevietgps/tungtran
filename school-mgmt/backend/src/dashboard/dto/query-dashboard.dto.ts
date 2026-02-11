import { IsOptional, IsString, Matches } from 'class-validator';

export class QueryDashboardDto {
  /** YYYY-MM-DD */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fromDate phải có định dạng YYYY-MM-DD' })
  fromDate?: string;

  /** YYYY-MM-DD */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'toDate phải có định dạng YYYY-MM-DD' })
  toDate?: string;
}
