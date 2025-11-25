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

  @Prop({ type: String, enum: Object.values(AttendanceStatus), default: AttendanceStatus.PRESENT })
  status!: AttendanceStatus;

  @Prop({ type: String, trim: true })
  notes?: string; // Ghi chú (lý do vắng, đi muộn, etc.)

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

// Tạo index để đảm bảo một học sinh chỉ có một bản ghi điểm danh cho mỗi lớp trong một ngày
AttendanceSchema.index({ classId: 1, studentId: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ attendanceToken: 1 }, { sparse: true });