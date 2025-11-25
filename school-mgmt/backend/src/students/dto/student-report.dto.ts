import { IsOptional, IsString } from 'class-validator';

export class StudentReportQueryDto {
  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  searchTerm?: string;
}
