import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Classroom, ClassDocument } from './schemas/class.schema';
import { CreateClassDto } from './dto/create-class.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { AssignStudentsDto } from './dto/assign-students.dto';
import { User, UserDocument } from '../users/schemas/user.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Invoice, InvoiceDocument, InvoiceStatus } from '../invoices/schemas/invoice.schema';
import { TeacherProfile } from '../teachers/schemas/teacher-profile.schema';
import { Role } from '../common/interfaces/role.enum';

@Injectable()
export class ClassesService {
  constructor(
    @InjectModel(Classroom.name) private readonly classModel: Model<ClassDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(TeacherProfile.name) private readonly teacherProfileModel: Model<any>,
  ) {}

  async create(dto: CreateClassDto, actor?: JwtPayload) {
    await this.ensureCodeUnique(dto.code);

    // SALE: phải có invoiceId + invoice phải APPROVED
    if (actor?.role === Role.SALE) {
      if (!dto.invoiceId) {
        throw new BadRequestException('SALE phải chọn hóa đơn đã duyệt để tạo lớp');
      }
      const invoice = await this.invoiceModel.findById(dto.invoiceId).lean();
      if (!invoice) {
        throw new NotFoundException('Hóa đơn không tồn tại');
      }
      if (invoice.status !== InvoiceStatus.APPROVED && invoice.status !== InvoiceStatus.PAID) {
        throw new ForbiddenException('Hóa đơn chưa được duyệt. Chỉ tạo lớp khi hóa đơn đã APPROVED');
      }
      // Auto-set saleId nếu chưa có
      if (!dto.saleId) {
        dto.saleId = (actor as any)._id.toString();
      }
    }

    const payload = await this.buildPayload(dto);

    // Link invoiceId nếu có
    if (dto.invoiceId) {
      (payload as any).invoiceId = new Types.ObjectId(dto.invoiceId);
    }

    const created = await new this.classModel(payload).save();

    // Link class ngược lại vào invoice
    if (dto.invoiceId) {
      await this.invoiceModel.updateOne(
        { _id: dto.invoiceId },
        { $set: { classId: created._id } },
      );
    }

    return this.findByIdPopulated(created._id);
  }

  async findOne(id: string) {
    const classroom = await this.findByIdPopulated(id);
    if (!classroom) throw new NotFoundException('Lớp học không tồn tại');
    return classroom;
  }

  async findAll(actor: JwtPayload) {
    let filter = {};
    
    if (actor.role === Role.SALE) {
      filter = { sale: actor._id };
    } else if (actor.role === Role.TEACHER) {
      filter = { teacher: actor._id };
    }
    // DIRECTOR, OPS có thể xem tất cả lớp (filter rỗng)
    
    const classrooms = await this.classModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate('teacher', 'fullName email role')
      .populate('sale', 'fullName email role')
      .populate('students', 'fullName age parentName studentCode')
      .lean();
    
    return classrooms.map(classroom => {
      const studentCount = classroom.students?.length || 0;
      const baseDur = (classroom as any).baseDuration || 60;
      const sessDur = classroom.sessionDuration || 60;
      const ratio = sessDur / baseDur;
      const actualPrice = Math.round((classroom.pricePerSession || classroom.revenuePerStudent || 0) * ratio);
      const actualTeacherPay = Math.round((classroom.teacherPayPerSession || classroom.teacherSalaryCost || 0) * ratio);
      const isOffline = (classroom as any).classMode === 'OFFLINE';
      const totalRevenue = actualPrice * studentCount;
      const totalCost = isOffline
        ? Math.round(((classroom as any).teacherPayPerStudent || 0) * ratio * studentCount)
        : actualTeacherPay;
      const profit = totalRevenue - totalCost;
      
      return {
        ...classroom,
        actualPricePerSession: actualPrice,
        actualTeacherPayPerSession: actualTeacherPay,
        totalRevenue,
        totalCost,
        profit,
        studentCount,
      };
    });
  }

  async update(id: string, dto: UpdateClassDto) {
    const update: Record<string, unknown> = {};
    if (dto.name) update.name = dto.name;
    if (dto.code) {
      await this.ensureCodeUnique(dto.code, id);
      update.code = dto.code.toUpperCase();
    }
    const members = await this.buildPayload(dto, true);
    Object.assign(update, members);

    const updated = await this.classModel.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!updated) throw new NotFoundException('Class not found');

    return this.findByIdPopulated(id);
  }

  async remove(id: string) {
    const classroom = await this.classModel.findById(id).lean();
    if (!classroom) throw new NotFoundException('Class not found');

    // Cascade: delete related attendance and session records
    const classObjectId = new Types.ObjectId(id);
    const AttendanceModel = this.studentModel.db.model('Attendance');
    const SessionModel = this.studentModel.db.model('Session');
    await Promise.all([
      AttendanceModel.deleteMany({ classId: classObjectId }),
      SessionModel.deleteMany({ classId: classObjectId }),
    ]);

    // Clear classId on linked invoices
    await this.invoiceModel.updateMany(
      { classId: classObjectId },
      { $unset: { classId: 1 } },
    );

    const deleted = await this.classModel.findByIdAndDelete(id).lean();
    return deleted;
  }

  async assignStudentsBySale(id: string, dto: AssignStudentsDto, actor: JwtPayload) {
    const classroom = await this.classModel.findById(id).lean();
    if (!classroom) throw new NotFoundException('Class not found');

    // Sale can only assign to their own classes; Director/OPS can assign to any
    if (actor.role === Role.SALE) {
      if (classroom.sale?.toString() !== actor._id.toString()) {
        throw new ForbiddenException('Bạn không phụ trách lớp này');
      }
    }
    const studentIds = dto.studentIds || [];
    if (!studentIds.length) throw new BadRequestException('Vui lòng chọn học viên');
    // Only allow APPROVED students to be enrolled
    const valid = await this.studentModel
      .find({ _id: { $in: studentIds }, approvalStatus: 'APPROVED' }, '_id')
      .lean();
    if (valid.length !== studentIds.length) {
      const invalidCount = studentIds.length - valid.length;
      throw new BadRequestException(`${invalidCount} học viên chưa được duyệt hoặc không hợp lệ`);
    }
    const existingStudentIds = classroom.students?.map((s: any) => s.toString()) || [];
    const merged = Array.from(
      new Set([...existingStudentIds, ...studentIds])
    ).map((sid) => new Types.ObjectId(sid));

    // Enforce class capacity
    if ((classroom as any).maxStudents && merged.length > (classroom as any).maxStudents) {
      throw new BadRequestException(
        `Lớp chỉ chứa tối đa ${(classroom as any).maxStudents} học viên (hiện có ${existingStudentIds.length})`,
      );
    }
    
    // Cập nhật danh sách học sinh trong lớp
    await this.classModel.findByIdAndUpdate(id, { students: merged });
    
    return this.findByIdPopulated(id);
  }

  private async ensureCodeUnique(code: string, excludeId?: string) {
    const existing = await this.classModel
      .findOne({ code: code.toUpperCase(), ...(excludeId ? { _id: { $ne: excludeId } } : {}) })
      .lean();
    if (existing) throw new ConflictException('Class code already exists');
  }

  private async buildPayload(
    dto: Partial<CreateClassDto>,
    allowPartial = false,
  ): Promise<Record<string, unknown>> {
    const payload: Record<string, unknown> = {};

    if (!allowPartial || dto.teacherId) {
      const teacherId = dto.teacherId ?? null;
      if (!teacherId) throw new BadRequestException('Teacher is required');
      payload.teacher = await this.validateUserRole(teacherId, Role.TEACHER);
    }

    // Sale is optional now (OPS/Director may not assign a Sale)
    if (dto.saleId) {
      payload.sale = await this.validateUserRole(dto.saleId, Role.SALE);
    }

    if (!allowPartial || dto.studentIds) {
      const ids = dto.studentIds ?? [];
      payload.students = await this.validateStudents(ids);
    }

    if (!allowPartial || dto.name) payload.name = dto.name;
    if (!allowPartial || dto.code) payload.code = dto.code?.toUpperCase();
    
    // Per-session pricing (new model)
    if (dto.pricePerSession !== undefined) payload.pricePerSession = dto.pricePerSession;
    if (dto.teacherPayPerSession !== undefined) payload.teacherPayPerSession = dto.teacherPayPerSession;
    if (dto.teacherPayPerStudent !== undefined) payload.teacherPayPerStudent = dto.teacherPayPerStudent;
    if ((dto as any).baseDuration !== undefined) payload.baseDuration = (dto as any).baseDuration;
    if (dto.sessionDuration !== undefined) payload.sessionDuration = dto.sessionDuration;
    if ((dto as any).classMode !== undefined) payload.classMode = (dto as any).classMode;

    // Thông tin môn học
    if (dto.subject !== undefined) payload.subject = dto.subject;
    if (dto.grade !== undefined) payload.grade = dto.grade;
    if (dto.learningGoals !== undefined) payload.learningGoals = dto.learningGoals;

    // Chương trình học (curriculum)
    if (dto.curriculum !== undefined) payload.curriculum = dto.curriculum;

    // Legacy fields
    if (dto.revenuePerStudent !== undefined) payload.revenuePerStudent = dto.revenuePerStudent;
    if (dto.teacherSalaryCost !== undefined) payload.teacherSalaryCost = dto.teacherSalaryCost;

    return payload;
  }

  private async validateUserRole(userId: string, role: Role): Promise<Types.ObjectId> {
    const user = await this.userModel.findById(userId).lean();
    if (!user || user.role !== role) {
      throw new BadRequestException(`Selected ${role.toLowerCase()} is invalid`);
    }
    return new Types.ObjectId(userId);
  }

  private async validateStudents(studentIds: string[]): Promise<Types.ObjectId[]> {
    if (!studentIds?.length) return [];
    const found = await this.studentModel.find({ _id: { $in: studentIds } }, '_id').lean();
    if (found.length !== studentIds.length) {
      throw new BadRequestException('Một số học viên không hợp lệ');
    }
    return studentIds.map((id) => new Types.ObjectId(id));
  }
  private async findByIdPopulated(id: string | Types.ObjectId) {
    const classroom = await this.classModel
      .findById(id)
      .populate('teacher', 'fullName email role')
      .populate('sale', 'fullName email role')
      .populate('students', 'fullName age parentName')
      .lean();
    
    if (classroom) {
      // Tính toán tổng doanh thu và chi phí
      const studentCount = classroom.students?.length || 0;
      const baseDur = (classroom as any).baseDuration || 60;
      const sessDur = classroom.sessionDuration || 60;
      const ratio = sessDur / baseDur;
      const isOffline = (classroom as any).classMode === 'OFFLINE';
      const totalRevenue = Math.round((classroom.pricePerSession || classroom.revenuePerStudent || 0) * ratio) * studentCount;
      const totalCost = isOffline
        ? Math.round(((classroom as any).teacherPayPerStudent || 0) * ratio * studentCount)
        : Math.round((classroom.teacherPayPerSession || classroom.teacherSalaryCost || 0) * ratio);
      const profit = totalRevenue - totalCost;

      // Tính tiến độ chương trình học
      const curriculum = (classroom as any).curriculum || [];
      const totalItems = curriculum.length;
      const completedItems = curriculum.filter((item: any) => item.isCompleted).length;
      const curriculumProgress = totalItems > 0
        ? Math.round((completedItems / totalItems) * 100)
        : 0;
      
      return {
        ...classroom,
        totalRevenue,
        totalCost,
        profit,
        studentCount,
        curriculumProgress,
      };
    }
    
    return classroom;
  }

  // ──────────────────────────────────────────────────────────────────
  //  CURRICULUM MANAGEMENT
  // ──────────────────────────────────────────────────────────────────

  /** Cập nhật toàn bộ chương trình học */
  async updateCurriculum(classId: string, curriculum: any[]) {
    const classroom = await this.classModel.findById(classId);
    if (!classroom) throw new NotFoundException('Lớp học không tồn tại');

    (classroom as any).curriculum = curriculum;
    await classroom.save();
    return this.findByIdPopulated(classId);
  }

  /** Đánh dấu một mục chương trình đã hoàn thành */
  async markCurriculumItemCompleted(
    classId: string,
    itemId: string,
    sessionId?: string,
  ) {
    const classroom = await this.classModel.findById(classId);
    if (!classroom) throw new NotFoundException('Lớp học không tồn tại');

    const curriculum = (classroom as any).curriculum || [];
    const item = curriculum.find((ci: any) => ci._id?.toString() === itemId);
    if (!item) throw new NotFoundException('Mục chương trình không tồn tại');

    item.isCompleted = true;
    item.completedAt = new Date();
    if (sessionId) {
      item.completedInSessionId = new Types.ObjectId(sessionId);
    }

    (classroom as any).curriculum = curriculum;
    await classroom.save();
    return this.findByIdPopulated(classId);
  }

  // ──────────────────────────────────────────────────────────────────
  //  SUBSTITUTE TEACHER MANAGEMENT
  // ──────────────────────────────────────────────────────────────────

  /** Thêm GV dạy thay vào lớp (gọi từ tickets.service khi duyệt ticket) */
  async addSubstituteTeacher(
    classId: string,
    data: {
      teacherId: string;
      fromDate: Date;
      toDate: Date;
      payRate: number;
      canCreateLink: boolean;
      ticketId?: string;
      approvedBy: string;
    },
  ) {
    const classroom = await this.classModel.findById(classId);
    if (!classroom) throw new NotFoundException('Lớp học không tồn tại');

    // Validate substitute teacher exists and is TEACHER role
    await this.validateUserRole(data.teacherId, Role.TEACHER);

    // Check no overlap for same substitute teacher in this class
    const subs = (classroom as any).substituteTeachers || [];
    const overlap = subs.find(
      (s: any) =>
        s.teacherId.toString() === data.teacherId &&
        new Date(s.toDate) >= data.fromDate &&
        new Date(s.fromDate) <= data.toDate,
    );
    if (overlap) {
      throw new BadRequestException(
        'GV dạy thay đã được phân công trong khoảng thời gian này',
      );
    }

    subs.push({
      teacherId: new Types.ObjectId(data.teacherId),
      fromDate: data.fromDate,
      toDate: data.toDate,
      payRate: data.payRate,
      canCreateLink: data.canCreateLink,
      ticketId: data.ticketId ? new Types.ObjectId(data.ticketId) : undefined,
      approvedBy: new Types.ObjectId(data.approvedBy),
      approvedAt: new Date(),
    });

    (classroom as any).substituteTeachers = subs;
    await classroom.save();
    return this.findByIdPopulated(classId);
  }

  /** Xóa GV dạy thay (trả lại quyền cho GV chính) */
  async removeSubstituteTeacher(classId: string, teacherId: string) {
    const classroom = await this.classModel.findById(classId);
    if (!classroom) throw new NotFoundException('Lớp học không tồn tại');

    const subs = (classroom as any).substituteTeachers || [];
    (classroom as any).substituteTeachers = subs.filter(
      (s: any) => s.teacherId.toString() !== teacherId,
    );
    await classroom.save();
    return this.findByIdPopulated(classId);
  }

  /** Lấy GV dạy thay đang active cho lớp tại ngày cụ thể */
  async getActiveSubstitute(
    classId: string,
    date: Date,
  ): Promise<{ teacherId: string; payRate: number; canCreateLink: boolean } | null> {
    const classroom = await this.classModel.findById(classId).lean();
    if (!classroom) return null;

    const subs = (classroom as any).substituteTeachers || [];
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

    const active = subs.find((s: any) => {
      const from = new Date(s.fromDate);
      const to = new Date(s.toDate);
      from.setUTCHours(0, 0, 0, 0);
      to.setUTCHours(23, 59, 59, 999);
      return s.teacherId && d >= from && d <= to;
    });

    if (!active) return null;
    return {
      teacherId: active.teacherId.toString(),
      payRate: active.payRate ?? 0,
      canCreateLink: active.canCreateLink ?? true,
    };
  }

  /** Lấy tiến độ chương trình học */
  async getCurriculumProgress(classId: string) {
    const classroom = await this.classModel.findById(classId).lean();
    if (!classroom) throw new NotFoundException('Lớp học không tồn tại');

    const curriculum = (classroom as any).curriculum || [];
    const totalItems = curriculum.length;
    const completedItems = curriculum.filter((item: any) => item.isCompleted).length;

    return {
      classId,
      classCode: classroom.code,
      className: classroom.name,
      subject: (classroom as any).subject,
      grade: (classroom as any).grade,
      learningGoals: (classroom as any).learningGoals,
      curriculum,
      totalItems,
      completedItems,
      progressPercent: totalItems > 0
        ? Math.round((completedItems / totalItems) * 100)
        : 0,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  // TEACHER MATCHING (Phase 2.5)
  // ════════════════════════════════════════════════════════════════════

  async suggestTeachers(params: {
    subject?: string;
    grade?: string;
    teachingMode?: string;
  }) {
    const filter: any = { status: 'ACTIVE' };
    if (params.subject) filter.subjects = params.subject;
    if (params.grade) filter.grades = params.grade;
    if (params.teachingMode) filter.teachingMode = params.teachingMode;

    const profiles = await this.teacherProfileModel
      .find(filter)
      .populate('userId', 'fullName email')
      .lean();

    // Score each teacher
    const scored: any[] = [];
    for (const profile of profiles) {
      let score = 50; // base score
      const reasons: string[] = [];

      // Subject match
      if (params.subject && (profile as any).subjects?.includes(params.subject)) {
        score += 20;
        reasons.push('Đúng môn dạy');
      }
      // Grade match
      if (params.grade && (profile as any).grades?.includes(params.grade)) {
        score += 15;
        reasons.push('Đúng khối lớp');
      }
      // Teaching mode match
      if (params.teachingMode && (profile as any).teachingMode === params.teachingMode) {
        score += 10;
        reasons.push('Đúng hình thức dạy');
      }

      // Workload (fewer active classes = higher score)
      const activeClasses = await this.classModel.countDocuments({
        teacher: (profile as any).userId?._id,
        status: 'ACTIVE',
      });
      if (activeClasses < 3) {
        score += 10;
        reasons.push('Ít lớp đang dạy');
      } else if (activeClasses < 5) {
        score += 5;
      }

      // Rating bonus
      const rating = (profile as any).averageRating || 0;
      if (rating >= 4.5) {
        score += 10;
        reasons.push(`Rating: ${rating}/5`);
      } else if (rating >= 4.0) {
        score += 5;
      }

      scored.push({
        teacherId: (profile as any).userId?._id,
        teacherName: (profile as any).userId?.fullName || '',
        email: (profile as any).userId?.email || '',
        subjects: (profile as any).subjects,
        grades: (profile as any).grades,
        teachingMode: (profile as any).teachingMode,
        activeClasses,
        rating,
        score: Math.min(score, 100),
        reasons,
      });
    }

    // Sort by score descending, return top 5
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 5);
  }
}
