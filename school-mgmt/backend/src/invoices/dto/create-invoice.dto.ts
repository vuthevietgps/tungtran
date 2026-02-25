import { IsNotEmpty, IsNumber, IsOptional, IsString, IsDateString, Min, IsMongoId, IsEnum, Matches } from 'class-validator';

export class CreateInvoiceDto {
  @IsString()
  @IsNotEmpty()
  invoiceNumber!: string;

  /** Loại hóa đơn: TUITION (học phí nạp ví), MATERIAL, OTHER */
  @IsOptional()
  @IsEnum(['TUITION', 'MATERIAL', 'OTHER'])
  invoiceType?: string;

  /** Loại lớp học: ONLINE hoặc OFFLINE */
  @IsOptional()
  @IsEnum(['ONLINE', 'OFFLINE'])
  classType?: string;

  @IsMongoId()
  @IsNotEmpty()
  studentId!: string;

  /** Lớp học liên quan (optional - có thể thanh toán trước khi tạo lớp) */
  @IsMongoId()
  @IsOptional()
  classId?: string;

  /** Sale phụ trách — dù ai tạo invoice vẫn ghi nhận doanh thu cho sale này */
  @IsMongoId()
  @IsOptional()
  saleId?: string;

  /** Số buổi đăng ký thanh toán */
  @IsNumber()
  @Min(1)
  @IsOptional()
  sessions?: number;

  /** Giá mỗi buổi tại thời điểm lập hóa đơn (cho referenceDuration phút) */
  @IsNumber()
  @Min(0)
  @IsOptional()
  pricePerSession?: number;

  /**
   * Thời lượng tham chiếu (phút) mà pricePerSession dựa trên.
   * VD: nạp 3.8M cho 20 buổi 70 phút → referenceDuration = 70.
   * Nếu không truyền, lấy từ Class.baseDuration.
   */
  @IsNumber()
  @Min(1)
  @IsOptional()
  referenceDuration?: number;

  @IsNumber()
  @Min(0)
  amount!: number;

  @IsDateString()
  paymentDate!: string;

  @IsOptional()
  @IsString()
  @Matches(/^(https?:\/\/|\/uploads\/|data:image\/)/, {
    message: 'receiptImage phải là URL, upload path, hoặc base64 image',
  })
  receiptImage?: string; // Optional now

  @IsOptional()
  @IsString()
  description?: string;

  // status removed — always set server-side to PENDING_APPROVAL
}