import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { Student } from '../../students/schemas/student.schema';
import { Classroom } from '../../classes/schemas/class.schema';

export type AttendanceDocument = HydratedDocument<Attendance>;

export enum AttendanceStatus {
  PRESENT = 'PRESENT',                        // Có mặt
  ABSENT_WITH_PERMISSION = 'ABSENT_WITH_PERMISSION',     // Vắng mặt xin phép
  LATE = 'LATE',                              // Đi muộn
  ABSENT_WITHOUT_PERMISSION = 'ABSENT_WITHOUT_PERMISSION', // Vắng mặt không phép
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

  @Prop({ type: String, enum: Object.values(AttendanceStatus), default: AttendanceStatus.PRESENT })
  status!: AttendanceStatus;

  @Prop({ type: String, trim: true })
  notes?: string; // Ghi chú (lý do vắng, đi muộn, etc.)

  @Prop({ type: String })
  imageUrl?: string; // URL ảnh chụp từ webcam khi điểm danh

  @Prop({ type: String })
  absenceProofImage?: string; // URL ảnh đơn xin phép hoặc xác nhận không phép

  @Prop({ type: Number, enum: [40, 50, 70, 90, 110], default: 70 })
  sessionDuration?: number; // Độ dài buổi học (phút)

  @Prop({ type: Number, min: 0, default: 1 })
  baseSessionsUsed?: number; // Số buổi quy đổi theo 70p đã tiêu hao

  @Prop({ type: String, index: { unique: true, sparse: true } })
  attendanceToken?: string; // Token để học sinh tự điểm danh qua link

  @Prop({ type: Date })
  tokenExpiresAt?: Date; // Thời gian hết hạn của token

  @Prop({ type: Date })
  attendedAt?: Date; // Thời gian thực tế học sinh điểm danh

  @Prop({ type: String, trim: true })
  sessionContent?: string; // Nội dung buổi học

  @Prop({ type: String, trim: true })
  comment?: string; // Nhận xét

  @Prop({ type: String, trim: true })
  recordLink?: string; // Link record

  @Prop({ type: String, trim: true })
  parentConfirm?: string; // Xác nhận phụ huynh

  @Prop({ type: Number, min: 0 })
  paymentStatus?: number; // Trung tâm check lương (số tiền)

  @Prop({ type: SchemaTypes.ObjectId, ref: User.name })
  checkedBy?: Types.ObjectId; // Người check lương

  @Prop({ type: Number, min: 0 })
  salaryAmount?: number; // Lương giáo viên đã chốt tại thời điểm điểm danh
}

export const AttendanceSchema = SchemaFactory.createForClass(Attendance);

// Tạo index để đảm bảo một học sinh chỉ có một bản ghi điểm danh cho mỗi lớp trong một ngày
AttendanceSchema.index({ classId: 1, studentId: 1, date: 1 }, { unique: true });
