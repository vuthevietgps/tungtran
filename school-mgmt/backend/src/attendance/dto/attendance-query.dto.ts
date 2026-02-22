import { IsDateString, IsMongoId, IsNotEmpty, IsOptional } from 'class-validator';

export class AttendanceByClassQueryDto {
  @IsDateString()
  @IsNotEmpty()
  date!: string;
}

export class AttendanceStatsQueryDto {
  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @IsDateString()
  @IsNotEmpty()
  endDate!: string;
}

export class AttendanceReportQueryDto {
  @IsDateString()
  @IsNotEmpty()
  startDate!: string;

  @IsDateString()
  @IsNotEmpty()
  endDate!: string;

  @IsMongoId()
  @IsOptional()
  classId?: string;
}

export class ParentAttendanceQueryDto {
  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @IsDateString()
  @IsOptional()
  toDate?: string;
}
