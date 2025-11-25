import { IsNotEmpty, IsString, IsDateString } from 'class-validator';

export class GenerateAttendanceLinkDto {
  @IsNotEmpty()
  @IsString()
  classId!: string;

  @IsNotEmpty()
  @IsString()
  studentId!: string;

  @IsNotEmpty()
  @IsDateString()
  date!: string; // Ngày điểm danh
}

export class StudentAttendanceDto {
  @IsNotEmpty()
  @IsString()
  token!: string;

  @IsNotEmpty()
  @IsString()
  imageBase64!: string; // Ảnh dưới dạng base64
}
