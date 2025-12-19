import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from './schemas/order.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Classroom, ClassDocument } from '../classes/schemas/class.schema';
import { Attendance, AttendanceDocument } from '../attendance/schemas/attendance.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { ConfigService } from '@nestjs/config';
import { ClassroomStatusService } from '../classroom-status/classroom-status.service';
import { PaymentRequestsService } from '../payment-requests/payment-requests.service';

type StudentLean = (Student & { _id: Types.ObjectId });
type ClassLean = (Classroom & { _id: Types.ObjectId });
type UserLean = (User & { _id: Types.ObjectId });

interface OrderSessionView {
  sessionIndex: number;
  date?: string;
  classCode?: string;
  studentCode?: string;
  classId?: string;
  teacherId?: string;
  teacherCode?: string;
  teacherEmail?: string;
  lookupUrl?: string;
  attendanceId?: string;
  attendedAt?: string;
  imageUrl?: string;
  sessionDuration?: number;
  salaryAmount?: number;
  status?: string;
}

export interface OrderView {
  _id: string;
  studentId?: string;
  studentName: string;
  studentCode: string;
  studentType?: string;
  level?: string;
  parentName: string;
  teacherId?: string;
  teacherName?: string;
  teacherEmail?: string;
  teacherCode?: string;
  teacherSalary?: number;
  saleId?: string;
  saleName?: string;
  saleEmail?: string;
  classId?: string;
  classCode?: string;
  invoiceNumber?: string;
  sessionsByInvoice?: number;
  expectedSessions?: number;
  sessionDuration?: number;
  dataStatus?: string;
  trialOrGift?: string;
  totalAttendedSessions?: number;
  teacherEarnedSalary?: number;
  paymentStatus?: string;
  paymentInvoiceCode?: string;
  paymentProofImage?: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
  sessions: OrderSessionView[];
}

@Injectable()
export class OrdersService {
  private readonly frontendBaseUrl: string;

  // Map session duration to salary field name
  private readonly SALARY_DURATION_MAP: Record<number, keyof { salary0: number; salary1: number; salary2: number; salary3: number; salary4: number; salary5: number }> = {
    40: 'salary0',
    50: 'salary1',
    70: 'salary2',
    90: 'salary3',
    110: 'salary4',
  };

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Classroom.name) private readonly classModel: Model<ClassDocument>,
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<AttendanceDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => ClassroomStatusService))
    private readonly classroomStatusService: ClassroomStatusService,
    @Inject(forwardRef(() => PaymentRequestsService))
    private readonly paymentRequestsService: PaymentRequestsService,
  ) {
    this.frontendBaseUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:4200');
  }

  // Called when attendance changes to sync sessions and salary to order consumers
  async syncFromAttendance(studentId: string, classId: string): Promise<void> {
    const student = studentId ? await this.studentModel.findById(studentId).lean<StudentLean>() : null;
    const classroom = classId ? await this.classModel.findById(classId).lean<ClassLean>() : null;
    const studentCode = student?.studentCode;
    const classCode = classroom?.code;

    const filter: any = {};
    if (studentId || studentCode) {
      filter.$and = filter.$and || [];
      const studentOr: any[] = [];
      if (studentId) studentOr.push({ studentId: new Types.ObjectId(studentId) });
      if (studentCode) studentOr.push({ studentCode: studentCode });
      if (studentOr.length) filter.$and.push({ $or: studentOr });
    }
    if (classId || classCode) {
      filter.$and = filter.$and || [];
      const classOr: any[] = [];
      if (classId) classOr.push({ classId: new Types.ObjectId(classId) });
      if (classCode) classOr.push({ classCode: classCode });
      if (classOr.length) filter.$and.push({ $or: classOr });
    }

    const orders = await this.orderModel.find(filter).lean();
    for (const order of orders) {
      const enriched = await this.enrich(order as any);
      await this.syncPaymentRequest(order._id, enriched);
    }
  }

  async create(dto: CreateOrderDto): Promise<OrderView> {
    const payload = await this.resolveReferences(this.preparePayload(dto));
    if (payload.studentCode) payload.studentCode = payload.studentCode.trim().toUpperCase();
    if (payload.classCode) payload.classCode = payload.classCode.trim().toUpperCase();

    const created = await this.orderModel.create(payload);
    const enriched = await this.enrich(created.toObject());
    
    // Sync downstream consumers
    await this.classroomStatusService.syncFromOrder(created._id, {
      studentCode: created.studentCode,
      studentName: created.studentName,
      classCode: created.classCode || '',
      status: created.status,
      paymentStatus: created.paymentStatus,
    });
    await this.syncPaymentRequest(created._id, enriched);
    
    return enriched;
  }

  async findAll(): Promise<OrderView[]> {
    // Sort by studentCode ascending, then createdAt descending
    const orders = await this.orderModel.find().sort({ studentCode: 1, createdAt: -1 }).lean();
    return Promise.all(orders.map((order) => this.enrich(order)));
  }

  async findOne(id: string): Promise<OrderView> {
    const order = await this.orderModel.findById(id).lean();
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return this.enrich(order);
  }

  async update(id: string, dto: UpdateOrderDto): Promise<OrderView> {
    const payload = await this.resolveReferences(this.preparePayload(dto));
    if (payload.studentCode) payload.studentCode = payload.studentCode.trim().toUpperCase();
    if (payload.classCode) payload.classCode = payload.classCode.trim().toUpperCase();

    const updated = await this.orderModel.findByIdAndUpdate(id, payload, { new: true }).lean();
    if (!updated) throw new NotFoundException('Không tìm thấy đơn hàng');
    const enriched = await this.enrich(updated);
    
    await this.classroomStatusService.syncFromOrder(updated._id, {
      studentCode: updated.studentCode,
      studentName: updated.studentName,
      classCode: updated.classCode || '',
      status: updated.status,
      paymentStatus: updated.paymentStatus,
    });
    await this.syncPaymentRequest(updated._id, enriched);
    
    return enriched;
  }

  async remove(id: string): Promise<{ success: true }> {
    const deleted = await this.orderModel.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException('Không tìm thấy đơn hàng');
    
    // Delete corresponding classroom status
    await this.classroomStatusService.deleteByOrderId(deleted._id);
    
    // Delete corresponding payment request
    await this.paymentRequestsService.deleteByOrderId(deleted._id);
    
    return { success: true };
  }

  private preparePayload(source: Partial<CreateOrderDto> | Partial<UpdateOrderDto>): Partial<Order> {
    const payload: Partial<Order> = { ...source } as any;

    if (payload.studentId && typeof payload.studentId === 'string') {
      payload.studentId = new Types.ObjectId(payload.studentId);
    }
    if (payload.teacherId && typeof payload.teacherId === 'string') {
      payload.teacherId = new Types.ObjectId(payload.teacherId);
    }
    if (payload.saleId && typeof payload.saleId === 'string') {
      payload.saleId = new Types.ObjectId(payload.saleId);
    }
    if (payload.classId && typeof payload.classId === 'string') {
      payload.classId = new Types.ObjectId(payload.classId);
    }

    if (payload.teacherSalary !== undefined && payload.teacherSalary !== null) {
      payload.teacherSalary = Number(payload.teacherSalary);
    }
    if (payload.sessionsByInvoice !== undefined && payload.sessionsByInvoice !== null) {
      payload.sessionsByInvoice = Number(payload.sessionsByInvoice);
    }

    if (payload.teacherEmail) {
      payload.teacherEmail = payload.teacherEmail.toLowerCase();
    }
    if (payload.saleEmail) {
      payload.saleEmail = payload.saleEmail.toLowerCase();
    }

    return payload;
  }

  private async resolveReferences(payload: Partial<Order>): Promise<Partial<Order>> {
    if (payload.studentCode && !payload.studentId) {
      const studentCode = payload.studentCode.trim().toUpperCase();
      const student = await this.studentModel.findOne({ studentCode }).lean();
      if (student) {
        payload.studentId = student._id as Types.ObjectId;
        payload.studentName = payload.studentName || student.fullName;
        payload.parentName = payload.parentName || student.parentName;
      }
    }

    if (payload.classCode && !payload.classId) {
      const classCode = payload.classCode.trim().toUpperCase();
      let classroom = await this.classModel.findOne({ code: classCode }).lean();
      
      // Auto-create class if not found
      if (!classroom && classCode) {
        console.log(`Auto-creating class with code: ${classCode}`);
        try {
          // Find a default teacher/sale or use system defaults
          const defaultTeacher = await this.userModel.findOne({ role: 'TEACHER' }).lean();
          const defaultSale = await this.userModel.findOne({ role: 'SALE' }).lean();
          
          const newClass = await this.classModel.create({
            name: `Lớp ${classCode}`,
            code: classCode,
            students: [],
            teacher: defaultTeacher?._id || new Types.ObjectId(),
            sale: defaultSale?._id || new Types.ObjectId(),
            revenuePerStudent: 0,
            teacherSalaryCost: 0,
          });
          // Re-fetch the created class to get proper lean object
          classroom = await this.classModel.findById(newClass._id).lean();
          if (classroom) {
            console.log(`Created new class: ${classroom.name} (${classroom.code})`);
          }
        } catch (error) {
          console.error(`Failed to create class ${classCode}:`, error);
        }
      }
      
      if (classroom) {
        payload.classId = classroom._id as Types.ObjectId;
      }
    }

    if (payload.teacherId) {
      const teacher = await this.userModel.findById(payload.teacherId).lean();
      if (teacher) {
        payload.teacherName = payload.teacherName || teacher.fullName;
        payload.teacherEmail = payload.teacherEmail || teacher.email;
      }
    } else if (payload.teacherEmail && !payload.teacherId) {
      const teacher = await this.userModel.findOne({ email: payload.teacherEmail.toLowerCase() }).lean();
      if (teacher) payload.teacherId = teacher._id as Types.ObjectId;
    }

    if (payload.saleId) {
      const sale = await this.userModel.findById(payload.saleId).lean();
      if (sale) {
        payload.saleName = payload.saleName || sale.fullName;
        payload.saleEmail = payload.saleEmail || sale.email;
      }
    } else if (payload.saleEmail && !payload.saleId) {
      const sale = await this.userModel.findOne({ email: payload.saleEmail.toLowerCase() }).lean();
      if (sale) payload.saleId = sale._id as Types.ObjectId;
    }

    return payload;
  }

  private async enrich(order: Order & { _id: Types.ObjectId }): Promise<OrderView> {
    const [student, classroom, teacher, sale] = await Promise.all([
      this.loadStudent(order.studentId, order.studentCode),
      this.loadClass(order.classId, order.classCode),
      this.loadUser(order.teacherId, order.teacherEmail),
      this.loadUser(order.saleId, order.saleEmail),
    ]);

    const sessions = await this.buildSessions(student, classroom, order);

    // Calculate total attended sessions from actual attendance data
    const attendedCount = sessions.filter(s => s.attendedAt).length;
    // Parse trial/gift sessions from trialOrGift field
    const trialGiftSessions = this.parseTrialGiftSessions(order.trialOrGift);
    const totalAttendedSessions = Math.max(0, attendedCount - trialGiftSessions);

    // Calculate teacher earned salary
    const teacherEarnedSalary = sessions.reduce((sum, s) => sum + (s.salaryAmount || 0), 0) || (order.teacherSalary || 0) * totalAttendedSessions;

    return {
      _id: order._id.toString(),
      studentId: student?._id?.toString() || order.studentId?.toString(),
      studentName: order.studentName || student?.fullName || '',
      studentCode: order.studentCode,
      studentType: student?.studentType || undefined,
      level: order.level,
      parentName: order.parentName || student?.parentName || '',
      teacherId: teacher?._id?.toString() || order.teacherId?.toString(),
      teacherName: order.teacherName || teacher?.fullName,
      teacherEmail: (order.teacherEmail || teacher?.email || undefined)?.toLowerCase(),
      teacherCode: order.teacherCode,
      teacherSalary: order.teacherSalary,
      saleId: sale?._id?.toString() || order.saleId?.toString(),
      saleName: order.saleName || sale?.fullName,
      saleEmail: (order.saleEmail || sale?.email || undefined)?.toLowerCase(),
      classId: classroom?._id?.toString() || order.classId?.toString(),
      classCode: classroom?.code || order.classCode,
      invoiceNumber: order.invoiceNumber,
      sessionsByInvoice: order.sessionsByInvoice,
      expectedSessions: order.expectedSessions,
      sessionDuration: order.sessionDuration,
      dataStatus: order.dataStatus,
      trialOrGift: order.trialOrGift,
      totalAttendedSessions,
      teacherEarnedSalary,
      paymentStatus: order.paymentStatus,
      paymentInvoiceCode: order.paymentInvoiceCode,
      paymentProofImage: order.paymentProofImage,
      status: order.status || 'Đang hoạt động',
      createdAt: this.toIso((order as any).createdAt),
      updatedAt: this.toIso((order as any).updatedAt),
      sessions,
    };
  }

  private async loadStudent(studentId?: Types.ObjectId, studentCode?: string): Promise<StudentLean | null> {
    if (studentId) {
      const student = await this.studentModel.findById(studentId).lean();
      if (student) return student as StudentLean;
    }
    if (studentCode) {
      const student = await this.studentModel.findOne({ studentCode }).lean();
      if (student) return student as StudentLean;
    }
    return null;
  }

  private async loadClass(classId?: Types.ObjectId, classCode?: string): Promise<ClassLean | null> {
    if (classId) {
      const classroom = await this.classModel.findById(classId).lean();
      if (classroom) return classroom as ClassLean;
    }
    if (classCode) {
      const classroom = await this.classModel.findOne({ code: classCode }).lean();
      if (classroom) return classroom as ClassLean;
    }
    return null;
  }

  private async loadUser(userId?: Types.ObjectId, email?: string): Promise<UserLean | null> {
    if (userId) {
      const user = await this.userModel.findById(userId).lean();
      if (user) return user as UserLean;
    }
    if (email) {
      const user = await this.userModel.findOne({ email: email.toLowerCase() }).lean();
      if (user) return user as UserLean;
    }
    return null;
  }

  private async buildSessions(student: StudentLean | null, classroom: ClassLean | null, order: Order): Promise<OrderSessionView[]> {
    if (!student?._id || !classroom?._id) return [];

    // Get all attendance records for this student in this class (sorted by date)
    const attendances = await this.attendanceModel
      .find({ 
        studentId: student._id, 
        classId: classroom._id, 
        attendedAt: { $ne: null } 
      })
      .sort({ attendedAt: 1 })
      .lean();

    // Preload teacher info for these attendance records
    const teacherIds = Array.from(new Set(
      attendances.map((a) => a.teacherId?.toString()).filter(Boolean)
    ));
    const teacherObjectIds = teacherIds.map((id) => new Types.ObjectId(id));
    const teachers = teacherObjectIds.length
      ? await this.userModel.find({ _id: { $in: teacherObjectIds } }).select('email fullName').lean<UserLean[]>()
      : [];
    const teacherMap = new Map<string, UserLean>();
    teachers.forEach((t) => teacherMap.set(t._id.toString(), t));

    // Create a map of attendance by session index (based on attendance order)
    const attendanceMap = new Map<number, any>();
    attendances.forEach((attendance, index) => {
      const sessionIndex = index + 1;
      const teacherIdStr = attendance.teacherId?.toString();
      const teacher = teacherIdStr ? teacherMap.get(teacherIdStr) : null;
      const teacherEmail = teacher?.email || order.teacherEmail || undefined;
      const teacherCode = this.teacherCodeFromEmail(teacherEmail) || order.teacherCode || teacherIdStr || undefined;
      const duration = attendance.sessionDuration || order.sessionDuration || 70;
      const salaryAmount = this.resolveTeacherSalary(classroom, attendance.teacherId as any, duration, order.teacherSalary);
      attendanceMap.set(sessionIndex, {
        sessionIndex,
        date: attendance.date?.toISOString(),
        classCode: classroom.code,
        studentCode: student.studentCode,
        classId: classroom._id.toString(),
        teacherId: teacherIdStr,
        teacherCode,
        teacherEmail,
        lookupUrl: this.buildLookupUrl(classroom.code, student.studentCode, attendance._id),
        attendanceId: attendance._id.toString(),
        attendedAt: attendance.attendedAt ? attendance.attendedAt.toISOString() : undefined,
        imageUrl: attendance.imageUrl || undefined,
        sessionDuration: duration,
        salaryAmount,
        status: (attendance as any).status,
      });
    });

    // Build sessions array (dynamic length, default 30 slots)
    const maxSessions = Math.max(
      attendanceMap.size,
      order.expectedSessions || 0,
      order.sessionsByInvoice || 0,
      30,
    );

    const sessions: OrderSessionView[] = [];
    for (let i = 1; i <= maxSessions; i++) {
      const attendance = attendanceMap.get(i);
      if (attendance) {
        sessions.push(attendance);
      } else {
        // Empty session slot
        sessions.push({
          sessionIndex: i,
          classCode: classroom.code,
          studentCode: student.studentCode,
          classId: classroom._id.toString(),
          teacherCode: this.teacherCodeFromEmail(order.teacherEmail) || order.teacherCode,
        });
      }
    }

    return sessions;
  }

  private resolveTeacherSalary(classroom: ClassLean | null, teacherId: Types.ObjectId | undefined, sessionDuration: number, fallback?: number): number {
    if (!classroom?.teachers?.length || !teacherId) return fallback ?? 0;
    const teacherIdStr = teacherId.toString();
    const entry = (classroom.teachers as any[]).find((t) => {
      const id = t?.teacherId?._id?.toString?.() || t?.teacherId?.toString?.() || t?.toString?.();
      return id === teacherIdStr;
    });
    if (!entry) return fallback ?? 0;
    const field = this.SALARY_DURATION_MAP[sessionDuration] || this.SALARY_DURATION_MAP[70];
    const val = entry?.[field];
    if (Number.isFinite(val)) return Number(val);
    return fallback ?? 0;
  }

  private teacherCodeFromEmail(email?: string | null): string {
    if (!email) return '';
    const [prefix] = email.split('@');
    return prefix || email;
  }

  private buildLookupUrl(classCode: string, studentCode: string, attendanceId: Types.ObjectId): string {
    const params = new URLSearchParams({
      classCode,
      studentCode,
      attendanceId: attendanceId.toString(),
    });
    return `${this.frontendBaseUrl.replace(/\/$/, '')}/attendance-report?${params.toString()}`;
  }

  private parseTrialGiftSessions(trialOrGift?: string): number {
    if (!trialOrGift) return 0;
    // Try to extract number from string like "2 buổi", "3", "1 buổi học thử", etc.
    const match = trialOrGift.match(/(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return 0;
  }

  private toIso(value: unknown): string {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    if (value && typeof (value as any).toDate === 'function') {
      const date: Date = (value as any).toDate();
      if (date instanceof Date && !Number.isNaN(date.getTime())) return date.toISOString();
    }
    const now = new Date();
    return Number.isNaN(now.getTime()) ? new Date(Date.now()).toISOString() : now.toISOString();
  }

  private async syncPaymentRequest(orderId: Types.ObjectId, enriched: OrderView) {
    await this.paymentRequestsService.syncFromOrder(orderId, {
      studentCode: enriched.studentCode,
      studentName: enriched.studentName,
      classCode: enriched.classCode || '',
      teacherSalary: enriched.teacherSalary,
      sessions: enriched.sessions.map(s => ({
        sessionIndex: s.sessionIndex,
        date: s.date,
        attendedAt: s.attendedAt,
        imageUrl: s.imageUrl,
      })),
      totalAttendedSessions: enriched.totalAttendedSessions || 0,
      teacherEarnedSalary: enriched.teacherEarnedSalary || 0,
      paymentStatus: enriched.paymentStatus,
      paymentInvoiceCode: enriched.paymentInvoiceCode,
      paymentProofImage: enriched.paymentProofImage,
    });
  }
}
