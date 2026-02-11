import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type PayrollDocument = HydratedDocument<Payroll>;
export type PayrollItemDocument = HydratedDocument<PayrollItem>;

// ─── Enums ──────────────────────────────────────────────────────────

export enum PayrollStatus {
  DRAFT = 'DRAFT',             // Đang tạo / chỉnh sửa
  PENDING_REVIEW = 'PENDING_REVIEW', // Chờ DIRECTOR duyệt
  APPROVED = 'APPROVED',       // DIRECTOR đã duyệt → sẵn sàng chi
  PAID = 'PAID',               // Đã chi lương cho GV
  REJECTED = 'REJECTED',       // DIRECTOR từ chối
}

export enum PayrollItemStatus {
  INCLUDED = 'INCLUDED',       // Tính vào bảng lương
  EXCLUDED = 'EXCLUDED',       // Loại ra (buổi bị dispute, etc.)
  ADJUSTED = 'ADJUSTED',       // Đã điều chỉnh số tiền
}

// ─── PayrollItem: chi tiết từng buổi dạy trong 1 payroll ────────────

@Schema({ timestamps: true })
export class PayrollItem {
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Payroll', required: true })
  payrollId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Session', required: true })
  sessionId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Classroom', required: true })
  classId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Student', required: true })
  studentId!: Types.ObjectId;

  /** Ngày buổi học */
  @Prop({ type: Date, required: true })
  sessionDate!: Date;

  /** Lương GV cho buổi này */
  @Prop({ type: Number, min: 0, required: true })
  teacherPayout!: number;

  /** Số tiền thực tế sau điều chỉnh */
  @Prop({ type: Number, min: 0, required: true })
  adjustedPayout!: number;

  /** Lý do điều chỉnh (nếu có) */
  @Prop({ type: String, trim: true })
  adjustmentReason?: string;

  /** Trạng thái item */
  @Prop({ type: String, enum: PayrollItemStatus, default: PayrollItemStatus.INCLUDED })
  status!: PayrollItemStatus;
}

export const PayrollItemSchema = SchemaFactory.createForClass(PayrollItem);
PayrollItemSchema.index({ payrollId: 1 });
PayrollItemSchema.index({ sessionId: 1 });

// ─── Payroll: 1 bảng lương = 1 GV × 1 kỳ lương ────────────────────

@Schema({ timestamps: true })
export class Payroll {
  /** GV nhận lương */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  teacherId!: Types.ObjectId;

  /** Kỳ lương — bắt đầu */
  @Prop({ type: Date, required: true })
  periodStart!: Date;

  /** Kỳ lương — kết thúc */
  @Prop({ type: Date, required: true })
  periodEnd!: Date;

  /** Mã bảng lương (auto-gen hoặc nhập tay) */
  @Prop({ type: String, trim: true, unique: true })
  payrollCode!: string;

  // ── Totals ──

  /** Tổng số buổi (INCLUDED) */
  @Prop({ type: Number, min: 0, default: 0 })
  totalSessions!: number;

  /** Tổng lương gốc (sum teacherPayout) */
  @Prop({ type: Number, min: 0, default: 0 })
  grossAmount!: number;

  /** Các khoản điều chỉnh (+/-) */
  @Prop({ type: Number, default: 0 })
  adjustmentAmount!: number;

  /** Thưởng (nếu có) */
  @Prop({ type: Number, min: 0, default: 0 })
  bonusAmount!: number;

  /** Phạt / trừ (nếu có) */
  @Prop({ type: Number, min: 0, default: 0 })
  deductionAmount!: number;

  /** Tổng thực nhận = gross + bonus - deduction + adjustment */
  @Prop({ type: Number, min: 0, default: 0 })
  netAmount!: number;

  // ── Status & Approval ──

  @Prop({ type: String, enum: PayrollStatus, default: PayrollStatus.DRAFT })
  status!: PayrollStatus;

  /** Người tạo (OPS/ACCOUNTING) */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  /** DIRECTOR duyệt */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  approvedBy?: Types.ObjectId;

  @Prop({ type: Date })
  approvedAt?: Date;

  /** Lý do từ chối */
  @Prop({ type: String, trim: true })
  rejectionReason?: string;

  // ── Payment ──

  /** Ngày thực chi */
  @Prop({ type: Date })
  paidAt?: Date;

  /** Người xác nhận đã chi */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
  paidBy?: Types.ObjectId;

  /** Ghi chú chuyển khoản / mã ref */
  @Prop({ type: String, trim: true })
  paymentRef?: string;

  /** Ghi chú */
  @Prop({ type: String, trim: true })
  notes?: string;

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}

export const PayrollSchema = SchemaFactory.createForClass(Payroll);

// ─── Indexes ────────────────────────────────────────────────────────

PayrollSchema.index({ teacherId: 1, periodStart: 1, periodEnd: 1 });
PayrollSchema.index({ status: 1 });
PayrollSchema.index({ payrollCode: 1 }, { unique: true });
PayrollSchema.index({ createdAt: -1 });
