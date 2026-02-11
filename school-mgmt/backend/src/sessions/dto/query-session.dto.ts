import {
  IsDateString,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';
import { SessionStatus } from '../schemas/session.schema';

export class QuerySessionDto {
  @IsMongoId()
  @IsOptional()
  classId?: string;

  @IsMongoId()
  @IsOptional()
  studentId?: string;

  @IsMongoId()
  @IsOptional()
  teacherId?: string;

  @IsMongoId()
  @IsOptional()
  parentUserId?: string;

  @IsEnum(SessionStatus)
  @IsOptional()
  status?: SessionStatus;

  @IsDateString()
  @IsOptional()
  fromDate?: string; // Lọc từ ngày

  @IsDateString()
  @IsOptional()
  toDate?: string; // Lọc đến ngày

  @IsString()
  @IsOptional()
  sort?: string; // e.g. "-scheduledDate" (descending)

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
