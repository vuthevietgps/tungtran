import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Student } from '../../students/schemas/student.schema';
import { Classroom } from '../../classes/schemas/class.schema';

export type AttendanceDocument = HydratedDocument<Attendance>;

export enum AttendanceStatus {
  PRESENT = 'PRESENT',    // Có mặt
  ABSENT = 'ABSENT',      // Vắng mặt
  LATE = 'LATE',          // Đi muộn
  EXCUSED = 'EXCUSED',    // Xin phép
}

@Schema({ timestamps: true })
export class Attendance {
  @Prop({ type: SchemaTypes.ObjectId, ref: Classroom.name, required: true })
  classId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Student.name, required: true })
  studentId!: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name, required: true })
  teacherId!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  date!: Date;

  @Prop({ type: String, enum: Object.values(AttendanceStatus), required: false })
  status?: AttendanceStatus;

  @Prop({ type: String, trim: true })
  notes?: string; // Ghi chú (lý do vắng, đi muộn, etc.)

  // ── Liên kết tài chính ──
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Session' })
  sessionId?: Types.ObjectId; // Session tạo tự động khi điểm danh PRESENT/LATE → dùng để tính lương GV + trừ ví PH

  // ── Thông tin buổi học (for reporting) ──
  @Prop({ type: Number, min: 0 })
  sessionDuration?: number; // Thời lượng buổi học (phút)

  @Prop({ type: Number, min: 0 })
  sessionIndex?: number; // Buổi số bao nhiêu trong khóa

  @Prop({ type: String, trim: true })
  sessionContent?: string; // Nội dung buổi học (from teaching report)

  @Prop({ type: String, trim: true })
  comment?: string; // Nhận xét (from teaching report)

  @Prop({ type: String, trim: true })
  recordLink?: string; // Link recording (from teaching report)

  // ── Xác nhận & lương ──
  @Prop({ type: String, enum: ['PENDING', 'OK', 'ISSUE'] })
  parentConfirm?: string; // Xác nhận phụ huynh

  @Prop({ type: Number, min: 0 })
  salaryAmount?: number; // Lương GV cho buổi học này

  @Prop({ type: Number, default: 0 }) // 0=UNPAID, 1=PAID, 2=PROCESSING
  paymentStatus?: number; // Trạng thái thanh toán lương

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name })
  checkedBy?: Types.ObjectId; // Người check lương (HCNS/Manager)

  @Prop({ type: Date })
  checkedAt?: Date; // Thời gian check lương

  @Prop({ type: Boolean, default: false })
  hasTeachingReport?: boolean; // Có báo cáo giảng dạy hay chưa

  @Prop({ type: Date })
  reportDeadline?: Date; // Deadline nộp báo cáo

  @Prop({ type: Boolean, default: false })
  isLateReport?: boolean; // Nộp báo cáo muộn

  // ── Điểm danh qua link ──
  @Prop({ type: String })
  imageUrl?: string; // URL ảnh chụp từ webcam khi điểm danh

  @Prop({ type: String, unique: true, sparse: true })
  attendanceToken?: string; // Token để học sinh tự điểm danh qua link

  @Prop({ type: Date })
  tokenExpiresAt?: Date; // Thời gian hết hạn của token

  @Prop({ type: Date })
  attendedAt?: Date; // Thời gian thực tế học sinh điểm danh
}

export const AttendanceSchema = SchemaFactory.createForClass(Attendance);

// Unique: 1 học sinh / 1 lớp / 1 ngày
AttendanceSchema.index({ classId: 1, studentId: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ sessionId: 1 }, { sparse: true });
AttendanceSchema.index({ date: 1, status: 1 });
