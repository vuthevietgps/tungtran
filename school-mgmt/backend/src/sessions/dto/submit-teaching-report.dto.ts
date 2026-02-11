import { IsNotEmpty, IsOptional, IsString, MinLength, MaxLength, IsUrl, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * GV nộp báo cáo giảng dạy cho 1 buổi học.
 * Báo cáo bắt buộc để tính lương GV.
 * Có deadline: phải nộp trong vòng 24h sau buổi học.
 */
export class SubmitTeachingReportDto {
  /** Nội dung đã học trong buổi (bắt buộc, 20-2000 ký tự) */
  @IsString({ message: 'Nội dung học phải là chuỗi văn bản' })
  @IsNotEmpty({ message: 'Nội dung học không được để trống' })
  @MinLength(20, { message: 'Nội dung học phải có ít nhất 20 ký tự' })
  @MaxLength(2000, { message: 'Nội dung học không được vượt quá 2000 ký tự' })
  @Transform(({ value }) => value?.trim())
  lessonContent!: string;

  /** Thái độ / hành vi của học sinh (tùy chọn, tối đa 1000 ký tự) */
  @IsString({ message: 'Thái độ học sinh phải là chuỗi văn bản' })
  @IsOptional()
  @MaxLength(1000, { message: 'Thái độ học sinh không được vượt quá 1000 ký tự' })
  @Transform(({ value }) => value?.trim())
  studentAttitude?: string;

  /** Link ghi hình bài giảng (tùy chọn, phải là URL hợp lệ) */
  @IsString({ message: 'Link ghi hình phải là chuỗi văn bản' })
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'Link ghi hình phải là URL hợp lệ (https://...)' })
  @MaxLength(500, { message: 'Link ghi hình không được vượt quá 500 ký tự' })
  @Transform(({ value }) => value?.trim())
  recordingUrl?: string;

  /** Nhận xét chung của GV (tùy chọn, tối đa 1000 ký tự) */
  @IsString({ message: 'Nhận xét phải là chuỗi văn bản' })
  @IsOptional()
  @MaxLength(1000, { message: 'Nhận xét không được vượt quá 1000 ký tự' })
  @Transform(({ value }) => value?.trim())
  teacherComment?: string;

  /** Bài tập về nhà (tùy chọn, tối đa 1000 ký tự) */
  @IsString({ message: 'Bài tập về nhà phải là chuỗi văn bản' })
  @IsOptional()
  @MaxLength(1000, { message: 'Bài tập về nhà không được vượt quá 1000 ký tự' })
  @Transform(({ value }) => value?.trim())
  homework?: string;

  /** Ghi chú thêm (tùy chọn, tối đa 500 ký tự) */
  @IsString({ message: 'Ghi chú thêm phải là chuỗi văn bản' })
  @IsOptional()
  @MaxLength(500, { message: 'Ghi chú thêm không được vượt quá 500 ký tự' })
  @Transform(({ value }) => value?.trim())
  additionalNotes?: string;
}
