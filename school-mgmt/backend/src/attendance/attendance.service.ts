import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';
import { Attendance, AttendanceDocument, AttendanceStatus } from './schemas/attendance.schema';
import { CreateAttendanceDto, BulkAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { GenerateAttendanceLinkDto, StudentAttendanceDto } from './dto/generate-link.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Classroom, ClassDocument, ClassMode } from '../classes/schemas/class.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import { Invoice, InvoiceDocument } from '../invoices/schemas/invoice.schema';
import { Role } from '../common/interfaces/role.enum';
import { ClassesService } from '../classes/classes.service';
import { randomBytes } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { validateAndProcessBase64Image } from '../common/utils/image-validation.utils';
import { normalizeDate, dayRange } from '../common/utils/date.utils';

type StudentLean = Student & { _id: Types.ObjectId };
type ClassLean = Classroom & { _id: Types.ObjectId };

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Classroom.name) private readonly classModel: Model<ClassDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly classesService: ClassesService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════

  private getUserId(user: JwtPayload): string {
    return user?.sub ?? user?._id;
  }

  /**
   * Tính amountCharged cho 1 buổi học dựa trên per-minute rate từ Invoice.
   * Fallback sang class-level pricing nếu không có invoice.
   *
   * VD: Invoice 3,800,000 / 20 buổi / 70 phút → perMinuteRate = 2,714.29
   *   → buổi 90 phút: 2,714.29 × 90 = 244,286 đ
   */
  private async resolveAmountCharged(
    studentId: Types.ObjectId,
    classId: Types.ObjectId,
    durationMinutes: number,
    classroom: ClassLean,
  ): Promise<number> {
    // 1) Tìm Invoice APPROVED mới nhất có perMinuteRate
    const invoice = await this.invoiceModel.findOne({
      studentId,
      classId,
      status: 'APPROVED',
      perMinuteRate: { $gt: 0 },
    }).sort('-createdAt').select('perMinuteRate referenceDuration pricePerSession').lean();

    if (invoice?.perMinuteRate) {
      // Dùng per-minute rate từ Invoice × thời lượng thực tế
      return Math.round(invoice.perMinuteRate * durationMinutes);
    }

    // 2) Fallback: dùng class-level pricing + ratio
    const baseDuration = (classroom as any).baseDuration ?? (classroom as any).sessionDuration ?? 60;
    const pricePerSession = (classroom as any).pricePerSession ?? 0;
    const ratio = durationMinutes / baseDuration;
    return Math.round(pricePerSession * ratio);
  }

  private isTeacher(user: JwtPayload): boolean {
    return user?.role === Role.TEACHER;
  }

  private hasFullAccess(user: JwtPayload): boolean {
    return [Role.DIRECTOR, Role.OPS].includes(user?.role as Role);
  }

  private assertClassAccess(
    classroom: ClassLean | null,
    user: JwtPayload,
    date?: Date,
  ): asserts classroom is ClassLean {
    if (!classroom) throw new NotFoundException('Không tìm thấy lớp học');
    if (this.hasFullAccess(user)) return;
    if (this.isTeacher(user)) {
      const uid = this.getUserId(user);
      // GV chính
      const tid = classroom.teacher?.toString();
      if (tid && tid === uid) return;
      // GV dạy thay — check substituteTeachers[] active tại ngày
      if (date) {
        const subs = (classroom as any).substituteTeachers || [];
        const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
        const activeSub = subs.find((s: any) => {
          if (s.teacherId?.toString() !== uid) return false;
          const from = new Date(s.fromDate); from.setUTCHours(0, 0, 0, 0);
          const to = new Date(s.toDate); to.setUTCHours(23, 59, 59, 999);
          return d >= from && d <= to;
        });
        if (activeSub) return;
      }
      throw new ForbiddenException('Bạn không phụ trách lớp học này và không có quyền dạy thay cho ngày này');
    }
  }

  /**
   * Lấy thông tin GV dạy thay đang active cho lớp tại ngày cụ thể.
   * Trả về null nếu người dùng là GV chính hoặc không phải TEACHER.
   */
  private getSubstituteInfo(
    classroom: ClassLean,
    user: JwtPayload,
    date: Date,
  ): { teacherId: string; payRate: number; canCreateLink: boolean } | null {
    if (!this.isTeacher(user)) return null;
    const uid = this.getUserId(user);
    // Nếu là GV chính → không phải substitute
    if (classroom.teacher?.toString() === uid) return null;

    const subs = (classroom as any).substituteTeachers || [];
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const active = subs.find((s: any) => {
      if (s.teacherId?.toString() !== uid) return false;
      const from = new Date(s.fromDate); from.setUTCHours(0, 0, 0, 0);
      const to = new Date(s.toDate); to.setUTCHours(23, 59, 59, 999);
      return d >= from && d <= to;
    });

    if (!active) return null;
    return {
      teacherId: uid,
      payRate: active.payRate ?? 0,
      canCreateLink: active.canCreateLink ?? true,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // ENSURE REAL DOCUMENTS (Class / Student)
  // ═══════════════════════════════════════════════════════════════════

  /** Find or create Classroom from classCode */
  private async ensureClassForCode(classCode: string, user: JwtPayload): Promise<ClassLean> {
    const code = classCode.trim().toUpperCase();
    const existing = await this.classModel.findOne({ code }).lean<ClassLean>();
    if (existing) return existing;

    const teacherId = this.isTeacher(user)
      ? new Types.ObjectId(this.getUserId(user))
      : new Types.ObjectId();

    const doc = await this.classModel.create({
      name: `Lớp ${code}`,
      code,
      teacher: teacherId,
      students: [],
    });
    return doc.toObject() as ClassLean;
  }

  // ═══════════════════════════════════════════════════════════════════
  // SESSION BRIDGE — Attendance <-> Session (for payroll + wallet)
  //
  // Đây là cầu nối quan trọng nhất:
  // - Điểm danh PRESENT/LATE → tự động tạo Session (TEACHER_COMPLETED)
  // - Session → auto-confirm sau 48h → FINALIZED
  // - FINALIZED → trừ ví phụ huynh + sẵn sàng tính lương GV
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Create or update a Session when attendance = PRESENT / LATE (with transaction).
   * Returns the sessionId or null on failure.
   */
  private async syncSessionForAttendance(params: {
    classId: Types.ObjectId;
    studentId: Types.ObjectId;
    teacherId: Types.ObjectId;
    date: Date;
    classroom: ClassLean;
    substitutePayRate?: number; // Lương GV dạy thay (override teacherPayout)
  }): Promise<Types.ObjectId | null> {
    const { classId, studentId, teacherId, date, classroom, substitutePayRate } = params;

    const mongoSession = await this.connection.startSession();
    mongoSession.startTransaction();

    // Check for existing session on same day
    const range = dayRange(date);
    const existingSession = await this.sessionModel.findOne({
      classId,
      studentId,
      scheduledDate: range,
      status: { $nin: ['CANCELLED', 'RESCHEDULED'] },
    }).session(mongoSession);

    if (existingSession) {
      // Upgrade to TEACHER_COMPLETED if still SCHEDULED
      if (existingSession.status === 'SCHEDULED') {
        existingSession.status = 'TEACHER_COMPLETED' as any;
        existingSession.confirmation = existingSession.confirmation ?? ({} as any);
        existingSession.confirmation.teacherCompletedAt = new Date();
        await existingSession.save({ session: mongoSession });
      }
      await mongoSession.commitTransaction();
      return existingSession._id as Types.ObjectId;
    }

    const duration =
      (classroom as any).sessionDuration ?? (classroom as any).baseDuration ?? 60;

    // ── Financial: ưu tiên per-minute rate từ Invoice, fallback → Class ──
    const amountCharged = await this.resolveAmountCharged(
      studentId, classId, duration, classroom,
    );

    // ── Teacher payout calculation depends on classMode ──
    let teacherPayout: number;
    if (substitutePayRate !== undefined) {
      // GV dạy thay → dùng substitutePayRate
      teacherPayout = substitutePayRate;
    } else if ((classroom as any).classMode === ClassMode.OFFLINE) {
      // OFFLINE 1:N → lương GV = teacherPayPerStudent (per 1 HS)
      // Giá trị thực tế sẽ được tính lại trong bulkMarkAttendance
      // dựa trên số HS điểm danh toàn lớp hôm đó
      teacherPayout = (classroom as any).teacherPayPerStudent ?? 0;
    } else {
      // ONLINE 1:1 → lương GV cố định per session
      teacherPayout = (classroom as any).teacherPayPerSession ?? 0;
    }
    const student = await this.studentModel
      .findById(studentId)
      .select('parentUserId')
      .lean();

    // Session number - use atomic approach to prevent race condition
    // Find last sessionNumber for this student+class combination
    const lastSession = await this.sessionModel
      .findOne({
        classId,
        studentId,
        status: { $nin: ['CANCELLED', 'RESCHEDULED'] },
      })
      .sort('-sessionNumber')
      .select('sessionNumber')
      .session(mongoSession)
      .lean();
    
    const sessionNumber = (lastSession?.sessionNumber ?? 0) + 1;

    try {
      const created = await this.sessionModel.create(
        [
          {
            classId,
            studentId,
            teacherId,
            parentUserId: (student as any)?.parentUserId,
            sessionType: 'REGULAR',
            scheduledDate: date,
            durationMinutes: duration,
            sessionNumber,
            amountCharged,
            teacherPayout,
            status: 'TEACHER_COMPLETED',
            confirmation: { teacherCompletedAt: new Date() },
            autoConfirmAfterHours: 48,
            createdBy: teacherId,
          },
        ],
        { session: mongoSession },
      );
      
      await mongoSession.commitTransaction();
      return created[0]._id as Types.ObjectId;
    } catch (err: any) {
      await mongoSession.abortTransaction();
      
      if (err.code === 11000) {
        // Duplicate key — find the conflicting session
        const found = await this.sessionModel.findOne({
          classId,
          studentId,
          scheduledDate: range,
          status: { $nin: ['CANCELLED', 'RESCHEDULED'] },
        });
        return (found?._id as Types.ObjectId) ?? null;
      }
      this.logger.error(`Failed to create session: ${err.message}`, err.stack);
      return null;
    } finally {
      mongoSession.endSession();
    }
  }

  /** Cancel linked session when attendance changes to ABSENT/EXCUSED */
  private async cancelLinkedSession(sessionId?: Types.ObjectId): Promise<void> {
    if (!sessionId) return;
    const session = await this.sessionModel.findById(sessionId);
    if (!session) return;
    // Cannot cancel already-finalized sessions (wallet already deducted)
    if (['FINALIZED', 'CANCELLED', 'RESCHEDULED'].includes(session.status)) return;

    session.status = 'CANCELLED' as any;
    session.cancellation = {
      cancelledBy: 'SYSTEM',
      cancelReason: 'Hủy do điểm danh thay đổi thành vắng mặt/bảo lưu',
      cancelledAt: new Date(),
      refundPercent: 100,
      refundAmount: 0,
    } as any;
    await session.save();
  }

  // ═══════════════════════════════════════════════════════════════════
  // LOAD STUDENTS FOR A CLASS (from class.students)
  // ═══════════════════════════════════════════════════════════════════

  private async loadStudentsForClass(
    classroom: ClassLean,
    user: JwtPayload,
    date?: Date,
  ): Promise<StudentLean[]> {
    const cls = await this.classModel
      .findById(classroom._id)
      .populate('students', 'fullName age parentName studentCode faceImage parentPhone')
      .lean();
    return ((cls as any)?.students as StudentLean[]) || [];
  }

  // ═══════════════════════════════════════════════════════════════════
  // CORE: Process one attendance item (with session bridge)
  // ═══════════════════════════════════════════════════════════════════

  private async processOneStudent(params: {
    classId: string;
    studentId: string;
    date: Date;
    status: AttendanceStatus;
    notes: string;
    user: JwtPayload;
    classroom: ClassLean;
    substitutePayRate?: number;
    /** OFFLINE mode: force tạo session cho HS vắng (vẫn trừ ví) */
    forceSessionForAbsent?: boolean;
  }): Promise<{ attendance: any; sessionCreated: boolean }> {
    const { classId, studentId, date, status, notes, user, classroom, substitutePayRate, forceSessionForAbsent } = params;

    // Check if there's an existing FINALIZED session for this attendance — block changes
    const existingFinalized = await this.sessionModel.findOne({
      classId: new Types.ObjectId(classId),
      studentId: new Types.ObjectId(studentId),
      scheduledDate: date,
      status: { $in: ['FINALIZED', 'CANCELLED'] },
    });
    if (existingFinalized?.status === 'FINALIZED') {
      throw new BadRequestException(
        'Buổi học đã được xác nhận hoàn thành (FINALIZED). Không thể thay đổi điểm danh.',
      );
    }

    // Upsert attendance record
    const attendance = await this.attendanceModel.findOneAndUpdate(
      { classId, studentId, date },
      {
        teacherId: user._id,
        status,
        notes: notes || '',
      },
      { new: true, upsert: true },
    );

    let sessionCreated = false;

    const isPresent = status === AttendanceStatus.PRESENT || status === AttendanceStatus.LATE;

    if (isPresent) {
      // PRESENT / LATE → ensure Session exists (TEACHER_COMPLETED)
      const sid = await this.syncSessionForAttendance({
        classId: new Types.ObjectId(classId),
        studentId: new Types.ObjectId(studentId),
        teacherId: new Types.ObjectId(user._id),
        date,
        classroom,
        substitutePayRate,
      });
      if (sid) {
        attendance.sessionId = sid;
        await attendance.save();
        sessionCreated = true;
      }
    } else if (forceSessionForAbsent) {
      // ── OFFLINE mode: HS vắng vẫn tạo session (trừ ví, KHÔNG tính lương GV) ──
      const sid = await this.syncSessionForAbsentStudent({
        classId: new Types.ObjectId(classId),
        studentId: new Types.ObjectId(studentId),
        teacherId: new Types.ObjectId(user._id),
        date,
        classroom,
      });
      if (sid) {
        attendance.sessionId = sid;
        await attendance.save();
        sessionCreated = true;
      }
    } else {
      // ABSENT / EXCUSED → cancel linked session (if not yet finalized)
      if (attendance.sessionId) {
        await this.cancelLinkedSession(attendance.sessionId);
        attendance.sessionId = undefined;
        await attendance.save();
      }
    }

    return { attendance, sessionCreated };
  }

  // ═══════════════════════════════════════════════════════════════════
  // OFFLINE MODE: Session for absent students (vắng vẫn trừ ví)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * OFFLINE class: HS vắng mặt vẫn bị trừ ví (vì slot đã giữ).
   * Tạo session với teacherPayout = 0 (không tính lương GV cho HS vắng).
   */
  private async syncSessionForAbsentStudent(params: {
    classId: Types.ObjectId;
    studentId: Types.ObjectId;
    teacherId: Types.ObjectId;
    date: Date;
    classroom: ClassLean;
  }): Promise<Types.ObjectId | null> {
    const { classId, studentId, teacherId, date, classroom } = params;

    const range = dayRange(date);
    const existing = await this.sessionModel.findOne({
      classId, studentId, scheduledDate: range,
      status: { $nin: ['CANCELLED', 'RESCHEDULED'] },
    });
    if (existing) return existing._id as Types.ObjectId;

    const amountCharged = (classroom as any).pricePerSession ?? 0;
    const duration = (classroom as any).sessionDuration ?? (classroom as any).baseDuration ?? 60;
    const student = await this.studentModel.findById(studentId).select('parentUserId').lean();
    const count = await this.sessionModel.countDocuments({
      classId, studentId, status: { $nin: ['CANCELLED', 'RESCHEDULED'] },
    });

    try {
      const created = await this.sessionModel.create({
        classId, studentId, teacherId,
        parentUserId: (student as any)?.parentUserId,
        sessionType: 'REGULAR',
        scheduledDate: date,
        durationMinutes: duration,
        sessionNumber: count + 1,
        amountCharged,         // Vẫn trừ ví PH
        teacherPayout: 0,      // KHÔNG tính lương GV cho HS vắng
        status: 'TEACHER_COMPLETED',
        confirmation: { teacherCompletedAt: new Date() },
        autoConfirmAfterHours: 48,
        createdBy: teacherId,
      });
      this.logger.log(
        `[OFFLINE] Created deduct-only session for absent student ${studentId} in class ${classId}`,
      );
      return created._id as Types.ObjectId;
    } catch (err: any) {
      if (err.code === 11000) {
        const found = await this.sessionModel.findOne({
          classId, studentId, scheduledDate: range,
          status: { $nin: ['CANCELLED', 'RESCHEDULED'] },
        });
        return (found?._id as Types.ObjectId) ?? null;
      }
      this.logger.error(`[OFFLINE] Failed to create absent session: ${err.message}`);
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PUBLIC API — Main attendance operations
  // ═══════════════════════════════════════════════════════════════════

  /** Điểm danh một học sinh */
  async markAttendance(dto: CreateAttendanceDto, user: JwtPayload) {
    const date = normalizeDate(dto.date);
    const classroom = await this.classModel.findById(dto.classId).lean<ClassLean>();
    this.assertClassAccess(classroom, user, date);

    // Validate student belongs to this class
    const studentInClass = classroom.students?.some(
      (s: any) => s.toString() === dto.studentId,
    );
    if (!studentInClass) {
      throw new BadRequestException('Học sinh không thuộc lớp này');
    }

    // Check nếu là GV dạy thay → lấy payRate riêng
    const subInfo = this.getSubstituteInfo(classroom, user, date);

    const result = await this.processOneStudent({
      classId: dto.classId,
      studentId: dto.studentId,
      date,
      status: dto.status || AttendanceStatus.PRESENT,
      notes: dto.notes || '',
      user,
      classroom,
      substitutePayRate: subInfo?.payRate,
    });

    const populated = await this.attendanceModel
      .findById(result.attendance._id)
      .populate('studentId', 'fullName age parentName')
      .populate('classId', 'name code')
      .lean();

    return { ...populated, sessionCreated: result.sessionCreated };
  }

  /** Điểm danh nhiều học sinh cùng lúc (bulk) */
  async bulkMarkAttendance(dto: BulkAttendanceDto, user: JwtPayload) {
    const date = normalizeDate(dto.date);
    const classroom = await this.classModel.findById(dto.classId).lean<ClassLean>();
    this.assertClassAccess(classroom, user, date);

    const isOffline = (classroom as any).classMode === ClassMode.OFFLINE;

    // Check nếu là GV dạy thay → lấy payRate riêng
    const subInfo = this.getSubstituteInfo(classroom, user, date);

    // Load allowed students — only students from orders for this class
    const students = await this.loadStudentsForClass(classroom, user, date);
    const allowedIds = new Set(students.map((s) => s._id.toString()));

    // ── OFFLINE: đếm trước HS có mặt để tính lương GV ──
    let attendedCount = 0;
    if (isOffline) {
      for (const item of dto.attendances) {
        if (!allowedIds.has(item.studentId)) continue;
        if (item.status === AttendanceStatus.PRESENT || item.status === AttendanceStatus.LATE) {
          attendedCount++;
        }
      }
    }

    // ── OFFLINE: teacher payout = teacherPayPerStudent × số HS điểm danh ──
    let offlineTeacherPayout: number | undefined;
    if (isOffline && attendedCount > 0) {
      const payPerStudent = (classroom as any).teacherPayPerStudent ?? 0;
      offlineTeacherPayout = payPerStudent * attendedCount;
    }

    const results: any[] = [];
    const errors: Array<{ studentId: string; message: string }> = [];
    let sessionsCreated = 0;

    // ── Collect submitted student IDs ──
    const submittedIds = new Set(dto.attendances.map(a => a.studentId));

    for (const item of dto.attendances) {
      if (!allowedIds.has(item.studentId)) {
        errors.push({
          studentId: item.studentId,
          message: 'Học sinh không thuộc lớp học này',
        });
        continue;
      }

      const isPresent = item.status === AttendanceStatus.PRESENT || item.status === AttendanceStatus.LATE;

      try {
        const result = await this.processOneStudent({
          classId: dto.classId,
          studentId: item.studentId,
          date,
          status: item.status,
          notes: item.notes || '',
          user,
          classroom,
          substitutePayRate: subInfo?.payRate,
          // OFFLINE + vắng → vẫn tạo session (trừ ví)
          forceSessionForAbsent: isOffline && !isPresent,
        });
        results.push(result.attendance);
        if (result.sessionCreated) sessionsCreated++;
      } catch (err: any) {
        errors.push({
          studentId: item.studentId,
          message: err.message || 'Lỗi không xác định',
        });
      }
    }

    // ── OFFLINE: tạo session cho HS trong lớp nhưng KHÔNG có trong danh sách điểm danh ──
    if (isOffline) {
      for (const student of students) {
        const sid = student._id.toString();
        if (submittedIds.has(sid)) continue; // Đã xử lý ở trên

        try {
          const result = await this.processOneStudent({
            classId: dto.classId,
            studentId: sid,
            date,
            status: AttendanceStatus.ABSENT,
            notes: 'Không điểm danh (OFFLINE auto-absent)',
            user,
            classroom,
            substitutePayRate: subInfo?.payRate,
            forceSessionForAbsent: true, // Vẫn trừ ví
          });
          results.push(result.attendance);
          if (result.sessionCreated) sessionsCreated++;
        } catch (err: any) {
          errors.push({
            studentId: sid,
            message: err.message || 'Lỗi không xác định',
          });
        }
      }

      // ── OFFLINE: cập nhật teacherPayout cho tất cả session vừa tạo ──
      // Lương GV = teacherPayPerStudent × số HS có mặt (chia đều cho mỗi session HS có mặt)
      if (offlineTeacherPayout !== undefined && attendedCount > 0) {
        const range = dayRange(date);
        const teacherPayPerAttendedStudent =
          (classroom as any).teacherPayPerStudent ?? 0;

        // HS có mặt: mỗi session nhận teacherPayPerStudent
        await this.sessionModel.updateMany(
          {
            classId: new Types.ObjectId(dto.classId),
            scheduledDate: range,
            status: { $nin: ['CANCELLED', 'RESCHEDULED'] },
            teacherPayout: { $gt: 0 }, // Sessions of present students
          },
          { $set: { teacherPayout: teacherPayPerAttendedStudent } },
        );

        this.logger.log(
          `[OFFLINE] Class ${dto.classId}: ${attendedCount} attended, ` +
          `teacherPay per student = ${teacherPayPerAttendedStudent}, ` +
          `total teacher payout = ${offlineTeacherPayout}`,
        );
      }
    }

    return {
      success: results,
      errors,
      sessionsCreated,
      totalProcessed: results.length,
      totalErrors: errors.length,
      ...(isOffline ? { attendedCount, classMode: 'OFFLINE' } : {}),
    };
  }

  /** Lấy danh sách điểm danh theo lớp và ngày (bao gồm trạng thái đã lưu) */
  async getAttendanceByClass(classId: string, date: string, user: JwtPayload) {
    const classroom = await this.classModel.findById(classId).lean<ClassLean>();
    const attendanceDate = normalizeDate(date);
    this.assertClassAccess(classroom, user, attendanceDate);
    const students = await this.loadStudentsForClass(classroom, user, attendanceDate);

    // Existing attendance records for this day
    const attendances = await this.attendanceModel
      .find({ classId, date: attendanceDate })
      .populate('studentId', 'fullName age parentName studentCode')
      .lean();

    const attendanceMap = new Map<string, any>();
    for (const att of attendances) {
      const sid = att.studentId?._id?.toString() ?? att.studentId?.toString();
      if (sid) attendanceMap.set(sid, att);
    }

    const sorted = [...students].sort((a, b) =>
      (a.fullName || '').localeCompare(b.fullName || '', 'vi', { sensitivity: 'base' }),
    );

    const attendanceList = sorted.map((student) => {
      const sid = student._id.toString();
      const existing = attendanceMap.get(sid);
      return {
        student: {
          _id: sid,
          fullName: student.fullName,
          age: (student as any).age,
          parentName: (student as any).parentName,
          studentCode: (student as any).studentCode,
        },
        attendance: existing
          ? {
              _id: existing._id?.toString(),
              classId: existing.classId?.toString(),
              studentId: sid,
              date: existing.date,
              status: existing.status,
              notes: existing.notes || '',
              attendedAt: existing.attendedAt || null,
              imageUrl: existing.imageUrl || null,
              sessionId: existing.sessionId?.toString() || null,
            }
          : {
              _id: null,
              classId,
              studentId: sid,
              date: attendanceDate,
              status: null,
              notes: '',
              attendedAt: null,
              imageUrl: null,
              sessionId: null,
            },
      };
    });

    return {
      class: {
        _id: (classroom as any)._id,
        name: classroom.name,
        code: (classroom as any).code,
      },
      date: attendanceDate,
      attendanceList,
    };
  }

  /** Cập nhật trạng thái điểm danh (có đồng bộ Session) */
  async updateAttendance(id: string, dto: UpdateAttendanceDto, user: JwtPayload) {
    const attendance = await this.attendanceModel.findById(id);
    if (!attendance) throw new NotFoundException('Không tìm thấy bản ghi điểm danh');

    const classroom = await this.classModel
      .findById(attendance.classId)
      .lean<ClassLean>();
    this.assertClassAccess(classroom, user, attendance.date);

    // Check nếu là GV dạy thay → lấy payRate riêng
    const subInfo = this.getSubstituteInfo(classroom, user, attendance.date);

    const prevStatus = attendance.status;
    const newStatus = dto.status || prevStatus;

    if (dto.status) attendance.status = dto.status;
    if (dto.notes !== undefined) attendance.notes = dto.notes;
    attendance.teacherId = new Types.ObjectId(user._id);
    await attendance.save();

    // Session sync on status change
    const wasCounted = [AttendanceStatus.PRESENT, AttendanceStatus.LATE].includes(
      prevStatus,
    );
    const isCounted = [AttendanceStatus.PRESENT, AttendanceStatus.LATE].includes(
      newStatus,
    );

    if (!wasCounted && isCounted) {
      // ABSENT/EXCUSED → PRESENT/LATE: create session
      const sid = await this.syncSessionForAttendance({
        classId: attendance.classId,
        studentId: attendance.studentId,
        teacherId: new Types.ObjectId(user._id),
        date: attendance.date,
        classroom,
        substitutePayRate: subInfo?.payRate,
      });
      if (sid) {
        attendance.sessionId = sid;
        await attendance.save();
      }
    } else if (wasCounted && !isCounted) {
      // PRESENT/LATE → ABSENT/EXCUSED: cancel session
      if (attendance.sessionId) {
        await this.cancelLinkedSession(attendance.sessionId);
        attendance.sessionId = undefined;
        await attendance.save();
      }
    }

    return this.attendanceModel
      .findById(id)
      .populate('studentId', 'fullName age parentName')
      .populate('classId', 'name code')
      .lean();
  }

  /** Lịch sử điểm danh của một học sinh */
  async getStudentAttendanceHistory(studentId: string, classId?: string) {
    const filter: any = { studentId };
    if (classId) filter.classId = classId;

    return this.attendanceModel
      .find(filter)
      .populate('classId', 'name code')
      .populate('teacherId', 'fullName email')
      .sort({ date: -1 })
      .lean();
  }

  /** Thống kê điểm danh theo lớp */
  async getAttendanceStats(
    classId: string,
    startDate: string,
    endDate: string,
    user: JwtPayload,
  ) {
    const classroom = await this.classModel.findById(classId).lean<ClassLean>();
    this.assertClassAccess(classroom, user);

    const start = normalizeDate(startDate);
    const end = normalizeDate(endDate);
    end.setUTCHours(23, 59, 59, 999);

    const stats = await this.attendanceModel.aggregate([
      {
        $match: {
          classId: new Types.ObjectId(classId),
          date: { $gte: start, $lte: end },
        },
      },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    return { classId, period: { startDate, endDate }, statistics: stats };
  }

  // ═══════════════════════════════════════════════════════════════════
  // GENERATE LINK + PUBLIC ENDPOINTS (self-attendance via webcam)
  // ═══════════════════════════════════════════════════════════════════

  /** Tạo link điểm danh cho học sinh (GV/Director tạo, HS tự điểm danh) */
  async generateAttendanceLink(dto: GenerateAttendanceLinkDto, user: JwtPayload) {
    const classroom = await this.classModel.findById(dto.classId).lean<ClassLean>();
    const date = normalizeDate(dto.date);
    this.assertClassAccess(classroom, user, date);

    // GV dạy thay: kiểm tra quyền tạo link
    const subInfo = this.getSubstituteInfo(classroom, user, date);
    if (subInfo && !subInfo.canCreateLink) {
      throw new ForbiddenException('GV dạy thay không được OPS cấp quyền tạo link điểm danh');
    }

    const token = randomBytes(32).toString('hex');

    // Token hết hạn cuối ngày điểm danh (không phải cuối ngày hiện tại)
    const tokenExpiresAt = new Date(date);
    tokenExpiresAt.setUTCDate(tokenExpiresAt.getUTCDate() + 1);
    tokenExpiresAt.setUTCMilliseconds(-1); // 23:59:59.999

    const att = await this.attendanceModel
      .findOneAndUpdate(
        { classId: dto.classId, studentId: dto.studentId, date },
        {
          teacherId: user._id,
          status: AttendanceStatus.ABSENT,
          attendanceToken: token,
          tokenExpiresAt,
          imageUrl: null,
          attendedAt: null,
        },
        { new: true, upsert: true },
      )
      .populate('studentId', 'fullName age parentName')
      .populate('classId', 'name code');

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
    const attendanceUrl = `${baseUrl}/student-attendance/${token}`;

    return { attendance: att, attendanceUrl, token, expiresAt: tokenExpiresAt };
  }

  /** Public: Lấy thông tin điểm danh từ token */
  async getAttendanceByToken(token: string) {
    const att = await this.attendanceModel
      .findOne({ attendanceToken: token })
      .populate('studentId', 'fullName age parentName')
      .populate('classId', 'name code')
      .populate('teacherId', 'fullName email')
      .lean();

    if (!att) throw new NotFoundException('Link điểm danh không hợp lệ');
    if (att.tokenExpiresAt && new Date() > att.tokenExpiresAt) {
      throw new BadRequestException('Link điểm danh đã hết hạn');
    }
    if (att.attendedAt) {
      throw new BadRequestException('Đã điểm danh rồi, không thể điểm danh lại');
    }
    return att;
  }

  /** Public: Học sinh submit điểm danh qua link (chụp ảnh webcam) */
  async submitStudentAttendance(dto: StudentAttendanceDto) {
    const attendance = await this.attendanceModel.findOne({
      attendanceToken: dto.token,
    });
    if (!attendance) throw new NotFoundException('Link điểm danh không hợp lệ');
    if (attendance.tokenExpiresAt && new Date() > attendance.tokenExpiresAt) {
      throw new BadRequestException('Link điểm danh đã hết hạn');
    }
    if (attendance.attendedAt) {
      throw new BadRequestException('Đã điểm danh rồi');
    }

    // Validate and process image with security checks (5MB limit to match multer config)
    const imageData = validateAndProcessBase64Image(
      dto.imageBase64,
      5, // 5MB max
      `attendance_${attendance._id}`,
    );

    const uploadsDir = join(process.cwd(), 'uploads', 'attendance');
    await mkdir(uploadsDir, { recursive: true });
    await writeFile(join(uploadsDir, imageData.filename), imageData.buffer);

    // Update attendance
    attendance.status = AttendanceStatus.PRESENT;
    attendance.imageUrl = `/uploads/attendance/${imageData.filename}`;
    attendance.attendedAt = new Date();
    await attendance.save();

    // Create session for this PRESENT attendance (same bridge logic)
    const classroom = await this.classModel
      .findById(attendance.classId)
      .lean<ClassLean>();
    if (classroom) {
      const sid = await this.syncSessionForAttendance({
        classId: attendance.classId,
        studentId: attendance.studentId,
        teacherId: attendance.teacherId,
        date: attendance.date,
        classroom,
      });
      if (sid) {
        attendance.sessionId = sid;
        await attendance.save();
      }
    }

    return this.attendanceModel
      .findById(attendance._id)
      .populate('studentId', 'fullName age parentName')
      .populate('classId', 'name code')
      .populate('teacherId', 'fullName email')
      .lean();
  }

  // ═══════════════════════════════════════════════════════════════════
  // REPORTS
  // ═══════════════════════════════════════════════════════════════════

  async getAttendanceReport(startDate: string, endDate: string, classId?: string) {
    const start = normalizeDate(startDate);
    const end = normalizeDate(endDate);
    end.setUTCHours(23, 59, 59, 999);

    const filter: any = {
      date: { $gte: start, $lte: end },
      attendedAt: { $ne: null },
    };
    if (classId) filter.classId = new Types.ObjectId(classId);

    return this.attendanceModel
      .find(filter)
      .populate('studentId', 'fullName age parentName faceImage studentCode')
      .populate('classId', 'name code')
      .populate('teacherId', 'fullName email')
      .sort({ attendedAt: -1 })
      .lean();
  }

  // ═══════════════════════════════════════════════════════════════════
  // CLASS LISTING FOR TEACHER (from Classes collection)
  // ═══════════════════════════════════════════════════════════════════

  async getTeacherClassAssignments(user: JwtPayload) {
    if (!this.isTeacher(user)) {
      throw new ForbiddenException('Chỉ giáo viên mới sử dụng chức năng này');
    }

    const teacherId = new Types.ObjectId(this.getUserId(user));
    const classes = await this.classModel
      .find({ teacher: teacherId })
      .populate('students', 'fullName age parentName studentCode parentPhone')
      .lean();

    return classes.map((cls: any) => ({
      classId: cls._id.toString(),
      classCode: cls.code || '',
      className: cls.name || `Lớp ${cls.code}`,
      studentCount: cls.students?.length || 0,
      students: (cls.students || [])
        .map((s: any) => ({
          studentId: s._id.toString(),
          fullName: s.fullName || '',
          studentCode: s.studentCode || '',
          age: s.age,
          parentName: s.parentName || '',
          parentPhone: s.parentPhone || '',
        }))
        .sort((a: any, b: any) =>
          a.fullName.localeCompare(b.fullName, 'vi', { sensitivity: 'base' }),
        ),
    })).sort((a: any, b: any) =>
      a.classCode.localeCompare(b.classCode, 'vi', { sensitivity: 'base' }),
    );
  }

  /**
   * Load classes with students — for all roles.
   * Returns classes from the Classes collection with populated students.
   */
  async getClassesWithStudents(user: JwtPayload) {
    const filter: any = {};

    if (this.isTeacher(user)) {
      filter.teacher = new Types.ObjectId(this.getUserId(user));
    }

    const classes = await this.classModel
      .find(filter)
      .populate('students', 'fullName age parentName studentCode parentPhone')
      .lean();

    return classes.map((cls: any) => ({
      classId: cls._id.toString(),
      classCode: cls.code || '',
      className: cls.name || `Lớp ${cls.code}`,
      studentCount: cls.students?.length || 0,
      students: (cls.students || [])
        .map((s: any) => ({
          studentId: s._id.toString(),
          fullName: s.fullName || '',
          studentCode: s.studentCode || '',
          age: s.age,
          parentName: s.parentName || '',
          parentPhone: s.parentPhone || '',
        }))
        .sort((a: any, b: any) =>
          a.fullName.localeCompare(b.fullName, 'vi', { sensitivity: 'base' }),
        ),
    })).sort((a: any, b: any) =>
      a.classCode.localeCompare(b.classCode, 'vi', { sensitivity: 'base' }),
    );
  }
}
