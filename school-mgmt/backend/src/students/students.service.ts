import { Injectable, ForbiddenException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';
import { Student, StudentDocument } from './schemas/student.schema';
import { Attendance, AttendanceDocument } from '../attendance/schemas/attendance.schema';
import { Classroom, ClassroomDocument } from '../classes/schemas/class.schema';
import { Session, SessionDocument } from '../sessions/schemas/session.schema';
import { Invoice, InvoiceDocument, InvoiceStatus } from '../invoices/schemas/invoice.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { Role } from '../common/interfaces/role.enum';

type StudentLean = Student & { _id: Types.ObjectId };

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Classroom.name) private readonly classroomModel: Model<ClassroomDocument>,
    @InjectModel(Session.name) private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  private getActorId(actor?: JwtPayload): string | null {
    return actor?.sub ?? actor?._id ?? (actor as any)?.userId ?? null;
  }

  findAll(actor?: JwtPayload) {
    return this.getStudentList(actor);
  }

  private async getStudentList(actor?: JwtPayload) {
    const actorId = this.getActorId(actor);
    // Sale chỉ thấy HS của mình
    const isSale = actor?.role === Role.SALE;
    const saleOid = isSale && actorId ? new Types.ObjectId(actorId) : undefined;

    // Parent chỉ thấy con mình
    const isParent = actor?.role === Role.PARENT;
    const parentOid = isParent && actorId ? new Types.ObjectId(actorId) : undefined;

    const studentFilter: any = {};
    if (saleOid) studentFilter.saleId = saleOid;
    if (parentOid) studentFilter.parentUserId = parentOid;

    const studentsFromDb = await this.studentModel.find(studentFilter)
      .populate('productPackage', 'name price')
      .sort({ createdAt: -1 })
      .lean<StudentLean[]>();

    return studentsFromDb
      .map(student => this.mapStudentDocument(student))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi', { sensitivity: 'base' }));
  }

  private mapStudentDocument(student: StudentLean) {
    const productPackage = student.productPackage as any;
    return {
      _id: student._id.toString(),
      studentCode: student.studentCode,
      fullName: student.fullName,
      age: student.age,
      studentBirthMonth: student.studentBirthMonth,
      parentBirthMonth: student.parentBirthMonth,
      parentUserId: student.parentUserId?.toString?.() || '',
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      faceImage: student.faceImage,
      approvalStatus: (student as any).approvalStatus || 'PENDING',
      payments: (student as any).payments || [],
      productPackage: productPackage && typeof productPackage === 'object'
        ? {
            _id: productPackage._id?.toString?.() ?? productPackage.toString(),
            name: productPackage.name,
            price: productPackage.price,
          }
        : undefined,
    };
  }

  private normalizeStudentCode(code?: string | null) {
    if (!code) return null;
    const trimmed = code.trim();
    return trimmed ? trimmed.toUpperCase() : null;
  }

  private async validateParentUser(parentUserId?: string) {
    if (!parentUserId) return;
    if (!Types.ObjectId.isValid(parentUserId)) {
      throw new BadRequestException('Ma phu huynh khong hop le');
    }

    const parent = await this.userModel
      .findById(parentUserId)
      .select('_id role')
      .lean();

    if (!parent || (parent as any).role !== Role.PARENT) {
      throw new BadRequestException('Ma phu huynh khong ton tai hoac sai role');
    }
  }

  async getStudentReport(classId?: string, searchTerm?: string, actor?: JwtPayload) {
    // Build filter for students
    const studentFilter: any = {};
    // Sale chỉ thấy HS của mình
    if (actor?.role === Role.SALE) {
      const actorId = this.getActorId(actor);
      if (actorId) {
        studentFilter.saleId = new Types.ObjectId(actorId);
      }
    }
    if (searchTerm) {
      // Escape special regex characters to prevent MongoDB injection
      const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      studentFilter.$or = [
        { fullName: { $regex: escapedTerm, $options: 'i' } },
        { parentName: { $regex: escapedTerm, $options: 'i' } },
        { parentPhone: { $regex: escapedTerm, $options: 'i' } }
      ];
    }

    const students = await this.studentModel.find(studentFilter)
      .populate('productPackage', 'name price')
      .lean();

    // Get all classes to map student to classes
    const classes = await this.classroomModel.find().populate('students', '_id').lean();

    // Build student to classes mapping
    const studentClassMap = new Map<string, any[]>();
    for (const cls of classes) {
      const studentIds = (cls.students || []).map((s: any) => s._id?.toString() || s.toString());
      for (const studentId of studentIds) {
        if (!studentClassMap.has(studentId)) {
          studentClassMap.set(studentId, []);
        }
        studentClassMap.get(studentId)!.push({
          _id: cls._id,
          name: cls.name,
          code: cls.code
        });
      }
    }

    // Get attendance counts for all students
    const studentIds = students.map(s => new Types.ObjectId((s as any)._id));
    const attendanceMatch: any = {
      studentId: { $in: studentIds },
      status: { $in: ['PRESENT', 'LATE'] },
    };
    if (classId && Types.ObjectId.isValid(classId)) {
      attendanceMatch.classId = new Types.ObjectId(classId);
    }
    const attendanceCounts = await this.attendanceModel.aggregate([
      {
        $match: attendanceMatch,
      },
      {
        $group: {
          _id: '$studentId',
          totalAttendance: { $sum: 1 }
        }
      }
    ]);

    const attendanceMap = new Map(
      attendanceCounts.map(item => [item._id.toString(), item.totalAttendance])
    );

    // Build report data
    const reportData = students.map(student => {
      const studentId = (student as any)._id.toString();
      const studentClasses = studentClassMap.get(studentId) || [];
      const totalAttendance = attendanceMap.get(studentId) || 0;

      // Filter by classId if provided
      if (classId) {
        const isInClass = studentClasses.some(cls => cls._id.toString() === classId);
        if (!isInClass) return null;
      }

      return {
        _id: student._id,
        studentCode: student.studentCode,
        fullName: student.fullName,
        age: student.age,
        parentName: student.parentName,
        parentPhone: student.parentPhone,
        faceImage: student.faceImage,
        productPackage: student.productPackage,
        totalAttendance
      };
    }).filter(item => item !== null);

    return reportData;
  }

  /**
   * Comprehensive report: each row = (student + classCode) pair.
   * Columns = student info + class info + numbered session columns (Buổi 1, 2, ...).
   * Each session cell: { date, status, attendedAt, duration, teacherCode }.
   */
  async getComprehensiveReport(classId?: string, searchTerm?: string, actor?: JwtPayload) {
    const toSafeNumber = (value: unknown, fallback = 0): number => {
      const num = Number(value);
      return Number.isFinite(num) ? num : fallback;
    };

    const resolveDataStatus = (student: any): string => {
      const approvalStatus = student?.approvalStatus || 'PENDING';
      if (approvalStatus !== 'APPROVED') return approvalStatus;

      const payments = Array.isArray(student?.payments) ? student.payments : [];
      if (payments.length === 0) return 'NO_PAYMENT';
      if (payments.some((p: any) => p?.confirmStatus === 'REJECTED')) return 'PAYMENT_REJECTED';
      if (payments.some((p: any) => (p?.confirmStatus || 'PENDING') === 'PENDING')) return 'PAYMENT_PENDING';
      return 'OK';
    };

    // 1. Build class filter
    const classFilter: any = {};
    if (classId) {
      if (!Types.ObjectId.isValid(classId)) {
        return { maxSessions: 0, rows: [] };
      }
      classFilter._id = new Types.ObjectId(classId);
    }
    // SALE can only see their own classes
    if (actor?.role === Role.SALE) {
      const actorId = this.getActorId(actor);
      if (actorId) {
        classFilter.sale = new Types.ObjectId(actorId);
      }
    }

    // 2. Get classes with populated teacher + students
    const classes = await this.classroomModel
      .find(classFilter)
      .populate('teacher', 'userCode fullName email')
      .populate('sale', 'fullName email')
      .populate('invoiceId', 'invoiceNumber')
      .populate(
        'students',
        'studentCode fullName age grade dateOfBirth studentBirthMonth parentBirthMonth parentName parentPhone faceImage productPackage saleName approvalStatus payments',
      )
      .lean();

    if (classes.length === 0) {
      return { maxSessions: 0, rows: [] };
    }

    // 3. Build (student, class) pairs
    type Pair = { student: any; cls: any };
    const pairs: Pair[] = [];
    const normalizedTerm = searchTerm?.trim().toLowerCase() || '';
    for (const cls of classes) {
      const students = (cls.students || []) as any[];
      for (const student of students) {
        if (normalizedTerm) {
          const match =
            student.fullName?.toLowerCase().includes(normalizedTerm) ||
            student.parentName?.toLowerCase().includes(normalizedTerm) ||
            student.parentPhone?.includes(normalizedTerm) ||
            student.studentCode?.toLowerCase().includes(normalizedTerm) ||
            student.saleName?.toLowerCase().includes(normalizedTerm) ||
            cls.code?.toLowerCase().includes(normalizedTerm);
          if (!match) continue;
        }
        pairs.push({ student, cls });
      }
    }

    if (pairs.length === 0) {
      return { maxSessions: 0, rows: [] };
    }

    // 4. Get all attendance records for the queried classes, populate teacher
    const classIds = classes.map((c) => (c as any)._id);
    const classById = new Map(classes.map((c) => [(c as any)._id.toString(), c]));
    const uniqueStudentIds = Array.from(
      new Set(pairs.map(({ student }) => student?._id?.toString()).filter(Boolean)),
    ).map((id) => new Types.ObjectId(id as string));

    const attendances = await this.attendanceModel
      .find({
        classId: { $in: classIds },
        studentId: { $in: uniqueStudentIds },
      })
      .populate('teacherId', 'userCode fullName email')
      .sort({ date: 1 })
      .lean();

    // 5. Build lookup: key = `studentId_classId` -> ordered array of session info
    const attendanceLookup = new Map<string, any[]>();

    for (const att of attendances) {
      const key = `${att.studentId?.toString()}_${att.classId?.toString()}`;
      if (!attendanceLookup.has(key)) {
        attendanceLookup.set(key, []);
      }
      const cls = classById.get(att.classId?.toString() || '');
      const attendanceTeacher = att.teacherId as any;
      const teacherCode =
        attendanceTeacher?.userCode ||
        attendanceTeacher?.email ||
        attendanceTeacher?.fullName ||
        '';

      attendanceLookup.get(key)!.push({
        date: att.date ? new Date(att.date).toISOString().split('T')[0] : null,
        status: att.status || null,
        attendedAt: att.attendedAt || null,
        duration: (cls as any)?.sessionDuration || (cls as any)?.baseDuration || 0,
        teacherCode,
      });
    }

    const invoices = await this.invoiceModel
      .find({
        classId: { $in: classIds },
        studentId: { $in: uniqueStudentIds },
        status: { $nin: [InvoiceStatus.CANCELLED, InvoiceStatus.REJECTED] },
      })
      .select('invoiceNumber classId studentId createdAt')
      .sort({ createdAt: -1 })
      .lean();

    const invoiceByPair = new Map<string, string>();
    for (const inv of invoices) {
      const key = `${(inv as any).studentId?.toString()}_${(inv as any).classId?.toString()}`;
      if (!invoiceByPair.has(key)) {
        invoiceByPair.set(key, (inv as any).invoiceNumber || '');
      }
    }

    const invoiceByClass = new Map<string, string>();
    for (const cls of classes) {
      invoiceByClass.set(
        (cls as any)._id.toString(),
        ((cls as any).invoiceId as any)?.invoiceNumber || '',
      );
    }

    // 6. Find max session count across all pairs
    let maxSessions = 0;
    for (const sessions of attendanceLookup.values()) {
      maxSessions = Math.max(maxSessions, sessions.length);
    }

    // 7. Build rows
    const rows = pairs.map(({ student, cls }) => {
      const key = `${student._id?.toString()}_${(cls as any)._id?.toString()}`;
      const sessions = attendanceLookup.get(key) || [];

      const attendedCount = sessions.filter((s) => s.status === 'PRESENT' || s.status === 'LATE').length;
      const absentCount = sessions.filter((s) => s.status === 'ABSENT').length;

      const classMode = (cls as any).classMode || 'ONLINE';
      const snapshot = (cls as any).pricingSnapshot || {};
      const teacherPayPerSession = toSafeNumber(
        snapshot.teacherPayPerSession,
        toSafeNumber((cls as any).teacherPayPerSession, toSafeNumber((cls as any).teacherSalaryCost, 0)),
      );
      const teacherPayPerStudent = toSafeNumber(
        snapshot.teacherPayPerStudent,
        toSafeNumber((cls as any).teacherPayPerStudent, 0),
      );
      const teacherSalary = classMode === 'OFFLINE' ? teacherPayPerStudent : teacherPayPerSession;
      const teacherSalaryType = classMode === 'OFFLINE' ? 'PER_STUDENT' : 'PER_SESSION';

      const classTeacher = (cls as any).teacher as any;
      const classTeacherCode = classTeacher?.userCode || classTeacher?.email || '';
      const classTeacherName = classTeacher?.fullName || '';
      const teacherCodeAndName = [classTeacherCode, classTeacherName].filter(Boolean).join(' - ');

      return {
        studentId: student._id?.toString(),
        studentCode: student.studentCode || '',
        fullName: student.fullName || '',
        age: student.age || 0,
        parentName: student.parentName || '',
        parentPhone: student.parentPhone || '',
        faceImage: student.faceImage || '',
        classId: (cls as any)._id?.toString(),
        classCode: cls.code || '',
        className: cls.name || '',
        subject: cls.subject || '',
        grade: cls.grade || '',
        level: student.grade || cls.grade || '',
        dateOfBirth: student.dateOfBirth || null,
        studentBirthMonth: student.studentBirthMonth || null,
        parentBirthMonth: student.parentBirthMonth || null,
        teacherName: classTeacherName,
        teacherCode: classTeacherCode,
        teacherCodeAndName,
        classMode,
        teacherSalary,
        teacherSalaryType,
        invoiceNumber: invoiceByPair.get(key) || invoiceByClass.get((cls as any)._id?.toString()) || '',
        pricePerSession: cls.pricePerSession || 0,
        totalSessions: cls.totalSessions || 0,
        sessionsCompleted: cls.sessionsCompleted || 0,
        saleName: student.saleName || ((cls as any).sale as any)?.fullName || '',
        dataStatus: resolveDataStatus(student),
        attendedCount,
        absentCount,
        sessions, // array of { date, status, attendedAt, duration, teacherCode }
      };
    });

    return { maxSessions, rows };
  }

  async create(createStudentDto: any, actor?: JwtPayload) {
    await this.validateParentUser(createStudentDto.parentUserId);

    // SALE ownership is always bound to current actor
    if (actor?.role === Role.SALE) {
      const actorId = this.getActorId(actor);
      if (!actorId) {
        throw new ForbiddenException('Khong xac dinh duoc sale');
      }
      createStudentDto.saleId = actorId;
      createStudentDto.saleName = actor.fullName || '';
    }
    const student = new this.studentModel(createStudentDto);
    return student.save();
  }

  async update(id: string, updateStudentDto: any, actor?: JwtPayload) {
    const existing = await this.studentModel.findById(id).select('saleId');
    if (!existing) {
      throw new NotFoundException('Hoc sinh khong ton tai');
    }

    if (updateStudentDto.parentUserId !== undefined) {
      await this.validateParentUser(updateStudentDto.parentUserId);
    }

    if (actor?.role === Role.SALE) {
      const actorId = this.getActorId(actor);
      if (!actorId) {
        throw new ForbiddenException('Khong xac dinh duoc sale');
      }
      if (existing.saleId?.toString() !== actorId) {
        throw new ForbiddenException('Ban khong phu trach hoc sinh nay');
      }
      if (updateStudentDto.saleId && updateStudentDto.saleId !== actorId) {
        throw new ForbiddenException('SALE khong duoc chuyen ownership hoc sinh');
      }
      updateStudentDto.saleId = actorId;
      if (!updateStudentDto.saleName) {
        updateStudentDto.saleName = actor.fullName || '';
      }
    }

    return this.studentModel.findByIdAndUpdate(id, updateStudentDto, { new: true });
  }

  async remove(id: string) {
    const existingStudent = await this.studentModel.findById(id);
    if (!existingStudent) return { deletedCount: 0 };

    // Pre-check active sessions (fast fail before starting transaction)
    const activeSessions = await this.sessionModel.countDocuments({
      studentId: new Types.ObjectId(id),
      status: { $in: ['SCHEDULED', 'TEACHER_COMPLETED', 'PARENT_CONFIRMED'] },
    });
    if (activeSessions > 0) {
      throw new BadRequestException(
        `Không thể xóa học sinh đang có ${activeSessions} buổi học chưa hoàn tất`,
      );
    }

    // Wrap all delete operations in a transaction for atomicity
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const studentObjectId = new Types.ObjectId(id);

        // Re-check active sessions inside transaction to prevent race condition
        const activeSessionsInTx = await this.sessionModel.countDocuments({
          studentId: studentObjectId,
          status: { $in: ['SCHEDULED', 'TEACHER_COMPLETED', 'PARENT_CONFIRMED'] },
        }).session(session);
        if (activeSessionsInTx > 0) {
          throw new BadRequestException(
            `Không thể xóa học sinh đang có ${activeSessionsInTx} buổi học chưa hoàn tất`,
          );
        }

        // Remove student from all classes
        await this.classroomModel.updateMany(
          { students: studentObjectId },
          { $pull: { students: studentObjectId } },
          { session },
        );

        // Delete attendance records
        await this.attendanceModel.deleteMany({ studentId: studentObjectId }, { session });

        // Finally delete the student
        await this.studentModel.findByIdAndDelete(id, { session });
      });

      this.logger.log(`Student ${id} deleted successfully (atomic transaction)`);
      return { deletedCount: 1 };
    } finally {
      await session.endSession();
    }
  }

  async findOne(id: string, actor?: JwtPayload) {
    const student = await this.studentModel.findById(id).populate('productPackage', 'name price');
    if (!student) {
      throw new NotFoundException('Hoc sinh khong ton tai');
    }

    const actorId = this.getActorId(actor);

    // PARENT can only view their own children
    if (actor?.role === Role.PARENT) {
      if (!actorId || student.parentUserId?.toString() !== actorId) {
        throw new NotFoundException('Hoc sinh khong ton tai');
      }
    }

    if (actor?.role === Role.SALE) {
      if (!actorId || student.saleId?.toString() !== actorId) {
        throw new NotFoundException('Hoc sinh khong ton tai');
      }
    }

    return student;
  }

  async approve(id: string, action: 'APPROVE' | 'REJECT', userId: string) {
    const student = await this.studentModel.findById(id);
    if (!student) throw new NotFoundException('Học sinh không tồn tại');
    if (student.approvalStatus !== 'PENDING') {
      throw new BadRequestException('Học sinh đã được xử lý trước đó');
    }
    const updateData: any = {
      approvalStatus: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      approvedBy: userId,
      approvedAt: new Date(),
    };
    return this.studentModel.findByIdAndUpdate(id, updateData, { new: true });
  }

  async findPendingApproval() {
    return this.studentModel.find({ approvalStatus: 'PENDING' })
      .populate('productPackage', 'name price')
      .sort({ createdAt: -1 });
  }

  /** @deprecated Dangerous — disabled. Use individual delete instead. */
  async clearAllStudentData() {
    throw new ForbiddenException(
      'Bulk deletion is disabled. Please delete students individually to ensure data integrity.',
    );
  }
}
