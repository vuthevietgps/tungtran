import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

/** OPS/DIRECTOR giải quyết ticket */
export class ResolveTicketDto {
  @IsString()
  @IsNotEmpty()
  summary!: string; // Tóm tắt kết quả

  @IsEnum(['APPROVED', 'REJECTED', 'PARTIAL', 'CANCELLED'])
  @IsNotEmpty()
  outcome!: 'APPROVED' | 'REJECTED' | 'PARTIAL' | 'CANCELLED';

  @IsNumber()
  @Min(0)
  @IsOptional()
  refundAmount?: number;

  // ── GV dạy thay — OPS chỉ định khi duyệt ──

  @IsNumber()
  @Min(0)
  @IsOptional()
  substitutePayRate?: number; // Lương GV dạy thay (VNĐ/buổi)

  @IsBoolean()
  @IsOptional()
  substituteCanCreateLink?: boolean; // Cho phép tạo link điểm danh
}
