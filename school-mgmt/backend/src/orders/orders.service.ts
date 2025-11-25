import { Injectable, NotFoundException } from '@nestjs/common';
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

type StudentLean = (Student & { _id: Types.ObjectId });
type ClassLean = (Classroom & { _id: Types.ObjectId });
type UserLean = (User & { _id: Types.ObjectId });

interface OrderSessionView {
  sessionIndex: number;
  date?: string;
  classCode?: string;
  studentCode?: string;
  lookupUrl?: string;
  attendanceId?: string;
  attendedAt?: string;
  imageUrl?: string;
}

export interface OrderView {
  _id: string;
  studentId?: string;
  studentName: string;
  studentCode: string;
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
  dataStatus?: string;
  trialOrGift?: string;
  createdAt: string;
  updatedAt: string;
  sessions: OrderSessionView[];
}

@Injectable()
export class OrdersService {
  private readonly frontendBaseUrl: string;

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Classroom.name) private readonly classModel: Model<ClassDocument>,
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<AttendanceDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly config: ConfigService,
  ) {
    this.frontendBaseUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:4200');
  }

  async create(dto: CreateOrderDto): Promise<OrderView> {
    const payload = await this.resolveReferences(this.preparePayload(dto));
    if (payload.studentCode) payload.studentCode = payload.studentCode.trim().toUpperCase();
    if (payload.classCode) payload.classCode = payload.classCode.trim().toUpperCase();

    const created = await this.orderModel.create(payload);
    return this.enrich(created.toObject());
  }

  async findAll(): Promise<OrderView[]> {
    const orders = await this.orderModel.find().sort({ createdAt: -1 }).lean();
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
    return this.enrich(updated);
  }

  async remove(id: string): Promise<{ success: true }> {
    const deleted = await this.orderModel.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException('Không tìm thấy đơn hàng');
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

    const sessions = await this.buildSessions(student, classroom);

    return {
      _id: order._id.toString(),
      studentId: student?._id?.toString() || order.studentId?.toString(),
      studentName: order.studentName || student?.fullName || '',
      studentCode: order.studentCode,
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
      dataStatus: order.dataStatus,
      trialOrGift: order.trialOrGift,
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

  private async buildSessions(student: StudentLean | null, classroom: ClassLean | null): Promise<OrderSessionView[]> {
    if (!student?._id || !classroom?._id) return [];

    const attendances = await this.attendanceModel
      .find({ studentId: student._id, classId: classroom._id, attendedAt: { $ne: null } })
      .sort({ date: 1 })
      .limit(20)
      .lean();

    return attendances.map((attendance, index) => ({
      sessionIndex: index + 1,
      date: attendance.date?.toISOString(),
      classCode: classroom.code,
      studentCode: student.studentCode,
      lookupUrl: this.buildLookupUrl(classroom.code, student.studentCode, attendance._id),
      attendanceId: attendance._id.toString(),
      attendedAt: attendance.attendedAt ? attendance.attendedAt.toISOString() : undefined,
      imageUrl: attendance.imageUrl || undefined,
    }));
  }

  private buildLookupUrl(classCode: string, studentCode: string, attendanceId: Types.ObjectId): string {
    const params = new URLSearchParams({
      classCode,
      studentCode,
      attendanceId: attendanceId.toString(),
    });
    return `${this.frontendBaseUrl.replace(/\/$/, '')}/attendance-report?${params.toString()}`;
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
}
