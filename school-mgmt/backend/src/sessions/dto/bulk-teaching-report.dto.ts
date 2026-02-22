import {
  IsDateString,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * GV nộp báo cáo giảng dạy cho TẤT CẢ học sinh trong 1 lớp OFFLINE vào 1 ngày.
 * Dùng cho lớp nhóm (classMode = OFFLINE) để tránh phải nộp từng báo cáo riêng lẻ.
 */
export class BulkTeachingReportDto {
  /** ID lớp học */
  @IsMongoId({ message: 'classId không hợp lệ' })
  @IsNotEmpty()
  classId!: string;

  /** Ngày buổi học (ISO 8601, ví dụ: 2026-02-22) */
  @IsDateString({}, { message: 'date phải đúng định dạng ISO 8601' })
  @IsNotEmpty()
  date!: string;

  /** Nội dung đã học trong buổi (bắt buộc, 20-2000 ký tự) */
  @IsString({ message: 'Nội dung học phải là chuỗi văn bản' })
  @IsNotEmpty({ message: 'Nội dung học không được để trống' })
  @MinLength(20, { message: 'Nội dung học phải có ít nhất 20 ký tự' })
  @MaxLength(2000, { message: 'Nội dung học không được vượt quá 2000 ký tự' })
  @Transform(({ value }) => value?.trim())
  lessonContent!: string;

  /** Thái độ / hành vi chung của học sinh trong buổi (tùy chọn) */
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim())
  studentAttitude?: string;

  /** Link ghi hình bài giảng (tùy chọn) */
  @IsString()
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'recordingUrl phải là URL hợp lệ (https://...)' })
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  recordingUrl?: string;

  /** Nhận xét chung của GV (tùy chọn) */
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim())
  teacherComment?: string;

  /** Bài tập về nhà (tùy chọn) */
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  @Transform(({ value }) => value?.trim())
  homework?: string;

  /** Ghi chú thêm (tùy chọn) */
  @IsString()
  @IsOptional()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  additionalNotes?: string;
}
