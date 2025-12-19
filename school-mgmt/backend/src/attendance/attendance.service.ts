import { 
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable, 
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Attendance, AttendanceDocument, AttendanceStatus } from './schemas/attendance.schema';
import { CreateAttendanceDto, BulkAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { GenerateAttendanceLinkDto, StudentAttendanceDto } from './dto/generate-link.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { Classroom, ClassDocument } from '../classes/schemas/class.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Role } from '../common/interfaces/role.enum';
import { randomBytes } from 'crypto';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { OrdersService } from '../orders/orders.service';

type StudentLean = Student & { _id: Types.ObjectId };
type ClassLean = Classroom & { _id: Types.ObjectId };
type OrderLean = Order & { _id: Types.ObjectId };

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Classroom.name) private readonly classModel: Model<ClassDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @Inject(forwardRef(() => OrdersService)) private readonly ordersService: OrdersService,
  ) {}

  private readonly ALLOWED_SESSION_DURATIONS = [40, 50, 70, 90, 110];

  private readonly SALARY_DURATION_MAP: Record<number, keyof { salary0: number; salary1: number; salary2: number; salary3: number; salary4: number; salary5: number }> = {
    40: 'salary0',
    50: 'salary1',
    70: 'salary2',
    90: 'salary3',
    110: 'salary4',
  };

  private normalizeSessionDuration(duration?: number): number {
    if (!duration) return 70;
    if (!this.ALLOWED_SESSION_DURATIONS.includes(duration)) {
      throw new BadRequestException('Độ dài buổi học không hợp lệ');
    }
    return duration;
  }

  private computeBaseSessionsUsed(status: AttendanceStatus, sessionDuration: number): number {
    if (status !== AttendanceStatus.PRESENT && status !== AttendanceStatus.LATE) return 0;
    return sessionDuration / 70;
  }

  private resolveTeacherSalary(classroom: ClassLean, teacherId: Types.ObjectId, sessionDuration: number): number {
    if (!classroom?.teachers?.length) return 0;
    const teacherIdStr = teacherId?.toString?.() || '';
    const teacher = (classroom.teachers as any[]).find((t) => {
      const id = t?.teacherId?._id?.toString?.() || t?.teacherId?.toString?.() || t?.toString?.();
      return id === teacherIdStr;
    });
    if (!teacher) return 0;
    const field = this.SALARY_DURATION_MAP[sessionDuration] || this.SALARY_DURATION_MAP[70];
    const val = teacher[field] ?? 0;
    return Number.isFinite(val) ? Number(val) : 0;
  }

  private attachSalary(att: any, classroom: ClassLean): any {
    if (!att) return att;
    const sessionDuration = att.sessionDuration || 70;
    const salaryAmount = this.resolveTeacherSalary(classroom, att.teacherId, sessionDuration);
    return { ...att, salaryAmount };
  }

  private isTeacher(user: UserDocument): boolean {
    return user?.role === Role.TEACHER;
  }

  private getUserId(user: UserDocument): string {
    return (user?._id as any)?.toString();
  }

  private async syncOrderAttendance(classId: string, studentIds: (string | Types.ObjectId)[]) {
    if (!this.ordersService) return;
    const unique = Array.from(new Set((studentIds || []).map((id) => id?.toString()).filter(Boolean)));
    for (const sid of unique) {
      try {
        await this.ordersService.syncFromAttendance(sid, classId);
      } catch (err) {
        console.error('Failed to sync orders from attendance', { classId, studentId: sid, err });
      }
    }
  }

  private normalizeStudentCode(studentCode?: string | null): string | null {
    if (!studentCode) return null;
    return studentCode.trim().toUpperCase();
  }

  private generateObjectId(): Types.ObjectId {
    return new Types.ObjectId();
  }

  private generateConsistentId(seed: string): Types.ObjectId {
    // Generate consistent ObjectId based on seed string
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(seed).digest('hex');
    // Take first 24 characters to create ObjectId-like string
    const objectIdString = hash.substring(0, 24);
    return new Types.ObjectId(objectIdString);
  }

  private async ensureClassroomForCode(classCode: string, user: UserDocument): Promise<ClassLean> {
    const normalizedCode = classCode.trim().toUpperCase();
    let classroom = await this.classModel.findOne({ code: normalizedCode }).lean<ClassLean>();
    if (classroom) return classroom;

    const sampleOrder = await this.orderModel.findOne({ classCode: normalizedCode }).lean<OrderLean>();

    const teacherId = sampleOrder?.teacherId
      || (this.isTeacher(user) ? new Types.ObjectId(this.getUserId(user)) : null)
      || sampleOrder?.saleId
      || new Types.ObjectId();

    const saleId = sampleOrder?.saleId || teacherId || new Types.ObjectId();

    const created = await this.classModel.create({
      name: `Lớp ${normalizedCode}`,
      code: normalizedCode,
      teachers: teacherId ? [teacherId] : [],
      sale: saleId,
      students: [],
    });

    return created.toObject() as ClassLean;
  }

  private async ensureStudentDocument(studentInfo: {
    tentativeId?: string;
    studentCode?: string | null;
    fullName?: string;
    parentName?: string;
    parentPhone?: string;
    age?: number;
  }): Promise<string> {
    if (studentInfo.tentativeId) {
      const existing = await this.studentModel.findById(studentInfo.tentativeId).lean<StudentLean>();
      if (existing) return existing._id.toString();
    }

    if (studentInfo.studentCode) {
      const existingByCode = await this.studentModel.findOne({ studentCode: studentInfo.studentCode }).lean<StudentLean>();
      if (existingByCode) return existingByCode._id.toString();
    }

    const created = await this.studentModel.create({
      studentCode: studentInfo.studentCode || `AUTO_${Date.now()}`,
      fullName: studentInfo.fullName || 'Chưa cập nhật',
      age: studentInfo.age || 8,
      parentName: studentInfo.parentName || 'Phụ huynh',
      parentPhone: studentInfo.parentPhone || '0000000000',
      faceImage: this.buildPlaceholderAvatar(studentInfo.fullName),
    });

    return created._id.toString();
  }

  private buildPlaceholderAvatar(name?: string) {
    const label = encodeURIComponent(name || 'Hoc sinh');
    return `https://ui-avatars.com/api/?background=667eea&color=fff&name=${label}`;
  }

  private assertClassAccess(classroom: ClassLean | null, user: UserDocument) {
    if (!classroom) {
      throw new NotFoundException('Không tìm thấy lớp học này');
    }

    if (!this.isTeacher(user)) {
      return;
    }

    const teacherIds = classroom.teachers ? (classroom.teachers as any[]).map(t => t.teacherId?.toString() || t.toString()) : [];
    const userId = this.getUserId(user);
    if (!teacherIds.includes(userId)) {
      throw new ForbiddenException('Bạn không phụ trách lớp học này');
    }
  }

  private buildOrderFilter(classroom: ClassLean, user: UserDocument) {
    const teacherFilter = this.isTeacher(user)
      ? { teacherId: this.getUserId(user) }
      : {};

    const filters: Record<string, unknown>[] = [{ classId: classroom._id, ...teacherFilter }];
    const classCode = this.normalizeStudentCode((classroom as any).code);

    if (classCode) {
      filters.push({ classId: null, classCode, ...teacherFilter });
      filters.push({ classId: { $exists: false }, classCode, ...teacherFilter });
      filters.push({ classCode, ...teacherFilter });
    }

    if (filters.length === 1) {
      return filters[0];
    }

    return { $or: filters };
  }

  private async loadStudentsFromOrders(classroom: ClassLean, user: UserDocument): Promise<StudentLean[]> {
    const orders = await this.orderModel.find(this.buildOrderFilter(classroom, user)).lean();
    if (!orders.length) return [];

    const studentIdSet = new Set<string>();
    const studentCodeSet = new Set<string>();

    for (const order of orders) {
      if (order.studentId) {
        studentIdSet.add(order.studentId.toString());
      }
      const normalizedCode = this.normalizeStudentCode((order as any).studentCode);
      if (normalizedCode) {
        studentCodeSet.add(normalizedCode);
      }
    }

    const [studentsById, studentsByCode] = await Promise.all([
      studentIdSet.size
        ? this.studentModel.find({ _id: { $in: Array.from(studentIdSet) } }).lean()
        : [],
      studentCodeSet.size
        ? this.studentModel.find({ studentCode: { $in: Array.from(studentCodeSet) } }).lean()
        : [],
    ]);

    const studentById = new Map<string, StudentLean>();
    const studentByCode = new Map<string, StudentLean>();

    const registerStudent = (student: any) => {
      const casted = student as StudentLean;
      studentById.set(casted._id.toString(), casted);
      const normalized = this.normalizeStudentCode((casted as any).studentCode);
      if (normalized) {
        studentByCode.set(normalized, casted);
      }
    };

    studentsById.forEach(registerStudent);
    studentsByCode.forEach(registerStudent);

    const result = new Map<string, StudentLean>();

    for (const order of orders) {
      let student: StudentLean | undefined;
      const studentId = order.studentId ? order.studentId.toString() : null;
      if (studentId) {
        student = studentById.get(studentId);
      }

      if (!student) {
        const normalized = this.normalizeStudentCode((order as any).studentCode);
        if (normalized) {
          student = studentByCode.get(normalized);
        }
      }

      if (student) {
        result.set(student._id.toString(), student);
      }
    }

    return Array.from(result.values());
  }

  private async getClassroom(classId: string, user: UserDocument): Promise<ClassLean> {
    const classroom = await this.classModel.findById(classId).lean<ClassLean>();
    this.assertClassAccess(classroom, user);
    return classroom as ClassLean;
  }

  private async loadClassroomWithStudents(
    classId: string,
    user: UserDocument,
    preferOrders = false,
  ): Promise<{ classroom: ClassLean; students: StudentLean[] }> {
    const classroom = await this.classModel.findById(classId)
      .populate('students', 'fullName age parentName studentCode faceImage')
      .lean<ClassLean & { students?: StudentLean[] }>();

    this.assertClassAccess(classroom as ClassLean | null, user);

    let students: StudentLean[] = [];

    if (preferOrders) {
      students = await this.loadStudentsFromOrders(classroom as ClassLean, user);
    }

    if (!students.length && Array.isArray((classroom as any)?.students)) {
      students = ((classroom as any).students as StudentLean[]);
    }

    if (!students.length && !preferOrders) {
      students = await this.loadStudentsFromOrders(classroom as ClassLean, user);
    }

    return {
      classroom: classroom as ClassLean,
      students,
    };
  }

  private ensureStudentInClass(students: StudentLean[], studentId: string): StudentLean {
    const student = students.find((st) => st._id.toString() === studentId);
    if (!student) {
      throw new BadRequestException('Học sinh không thuộc lớp học này');
    }
    return student;
  }

  // Điểm danh một học sinh
  async markAttendance(dto: CreateAttendanceDto, teacher: UserDocument) {
    const { classroom, students } = await this.loadClassroomWithStudents(dto.classId, teacher, true);
    this.ensureStudentInClass(students, dto.studentId);

    const sessionDuration = this.normalizeSessionDuration(dto.sessionDuration);
    const status = dto.status || AttendanceStatus.PRESENT;
    const baseSessionsUsed = this.computeBaseSessionsUsed(status, sessionDuration);

    // Tạo hoặc cập nhật điểm danh
    const attendanceDate = new Date(dto.date);
    attendanceDate.setHours(0, 0, 0, 0); // Đặt về đầu ngày

    try {
      const attendance = await this.attendanceModel.findOneAndUpdate(
        {
          classId: dto.classId,
          studentId: dto.studentId,
          date: attendanceDate
        },
        {
          teacherId: teacher._id,
          status,
          notes: dto.notes || '',
          sessionDuration,
          baseSessionsUsed
        },
        {
          new: true,
          upsert: true
        }
      ).populate('studentId', 'fullName age parentName')
       .populate('classId', 'name code')
       .lean();

      const enriched = this.attachSalary(attendance, classroom);
      await this.syncOrderAttendance(dto.classId, [dto.studentId]);
      return enriched;
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictException('Điểm danh cho học sinh này trong ngày đã tồn tại');
      }
      throw error;
    }
  }

  // Điểm danh nhiều học sinh cùng lúc
  async bulkMarkAttendance(dto: BulkAttendanceDto, teacher: UserDocument) {
    const { classroom, students } = await this.loadClassroomWithStudents(dto.classId, teacher, true);
    const allowedStudentIds = new Set(students.map((student) => student._id.toString()));

    const attendanceDate = new Date(dto.date);
    attendanceDate.setHours(0, 0, 0, 0);

    // Validate teacherId if provided
    let validatedTeacherId = teacher._id;
    if (dto.teacherId) {
      const teacherIds = (classroom.teachers as any[]).map(t => t.teacherId?.toString() || t.toString());
      if (teacherIds.includes(dto.teacherId)) {
        validatedTeacherId = new Types.ObjectId(dto.teacherId) as any;
      }
    }

    const results: any[] = [];
    const syncedStudentIds: string[] = [];
    
    for (const item of dto.attendances) {
      if (!allowedStudentIds.has(item.studentId)) {
        continue; // Bỏ qua học sinh không thuộc lớp
      }

      const sessionDuration = this.normalizeSessionDuration(item.sessionDuration ?? dto.sessionDuration);
      const status = item.status;
      const baseSessionsUsed = this.computeBaseSessionsUsed(status, sessionDuration);

      try {
        const attendance = await this.attendanceModel.findOneAndUpdate(
          {
            classId: dto.classId,
            studentId: item.studentId,
            date: attendanceDate
          },
          {
            teacherId: validatedTeacherId,
            status,
            notes: item.notes || '',
            sessionDuration,
            baseSessionsUsed
          },
          {
            new: true,
            upsert: true
          }
        ).populate('studentId', 'fullName age parentName')
         .lean();

        results.push(this.attachSalary(attendance, classroom as any));
        syncedStudentIds.push(item.studentId);
      } catch (error: any) {
        console.error('Error marking attendance for student:', item.studentId, error);
      }
    }

    if (syncedStudentIds.length) {
      await this.syncOrderAttendance(dto.classId, syncedStudentIds);
    }
    return results;
  }

  // Lấy danh sách giáo viên của lớp học
  async getClassTeachers(classId: string): Promise<any[]> {
    const classroom = await this.classModel.findById(classId)
      .populate('teachers', 'fullName email')
      .lean<ClassLean & { teachers?: any[] }>();
    
    if (!classroom) {
      throw new NotFoundException('Không tìm thấy lớp học');
    }

    // Extract teacher IDs from the teachers array (which now contains objects with teacherId and salaryLevel)
    return classroom.teachers ? (classroom.teachers as any[]).map(t => t.teacherId || t) : [];
  }

  // Lấy danh sách điểm danh theo lớp và ngày
  async getAttendanceByClass(classId: string, date: string, teacher: UserDocument) {
    const { classroom, students } = await this.loadClassroomWithStudents(classId, teacher, true);

    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);

    const attendances = await this.attendanceModel.find({
      classId,
      date: attendanceDate
    }).populate('studentId', 'fullName age parentName').lean();

    const attendanceMap = new Map<string, any>();
    attendances.forEach(att => {
      if (att?.studentId?._id) {
        attendanceMap.set(att.studentId._id.toString(), this.attachSalary(att, classroom));
      }
    });

    const sortedStudents = [...students].sort((a, b) => {
      const nameA = (a as any).fullName || '';
      const nameB = (b as any).fullName || '';
      return nameA.localeCompare(nameB, 'vi', { sensitivity: 'base' });
    });

    const result = sortedStudents.map(student => {
      const studentId = student._id.toString();
      const existingAttendance = attendanceMap.get(studentId);

      return {
        student,
        attendance: existingAttendance || {
          classId: classroom._id,
          studentId: studentId,
          date: attendanceDate,
          status: null,
          notes: ''
        }
      };
    });

    return {
      class: {
        _id: classroom._id,
        name: classroom.name,
        code: classroom.code
      },
      date: attendanceDate,
      attendanceList: result
    };
  }

  // Lấy lịch sử điểm danh của một học sinh
  async getStudentAttendanceHistory(studentId: string, classId?: string) {
    const filter: any = { studentId };
    if (classId) filter.classId = classId;

    return this.attendanceModel.find(filter)
      .populate('classId', 'name code')
      .populate('teacherId', 'fullName email')
      .sort({ date: -1 })
      .lean();
  }

  // Cập nhật trạng thái điểm danh
  async updateAttendance(id: string, dto: UpdateAttendanceDto, teacher: UserDocument) {
    const attendance = await this.attendanceModel.findById(id);
    
    if (!attendance) {
      throw new NotFoundException('Không tìm thấy bản ghi điểm danh');
    }

    const classroom = await this.classModel.findById(attendance.classId).lean<ClassLean>();
    this.assertClassAccess(classroom, teacher);

    const nextStatus = (dto.status ?? attendance.status) as AttendanceStatus;
    const nextDuration = this.normalizeSessionDuration(dto.sessionDuration ?? (attendance as any).sessionDuration);
    const nextBaseUsed = this.computeBaseSessionsUsed(nextStatus, nextDuration);

    // Cho phép tất cả user cập nhật điểm danh
    Object.assign(attendance, dto, {
      status: nextStatus,
      sessionDuration: nextDuration,
      baseSessionsUsed: nextBaseUsed,
    });
    await attendance.save();

    const updated = await this.attendanceModel.findById(id)
      .populate('studentId', 'fullName age parentName')
      .populate('classId', 'name code')
      .lean();

    await this.syncOrderAttendance(attendance.classId.toString(), [attendance.studentId.toString()]);

    return updated;
  }

  // Thống kê điểm danh theo lớp
  async getAttendanceStats(classId: string, startDate: string, endDate: string, teacher: UserDocument) {
    await this.getClassroom(classId, teacher);

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const stats = await this.attendanceModel.aggregate([
      {
        $match: {
          classId: new Types.ObjectId(classId),
          date: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    return {
      classId,
      period: { startDate, endDate },
      statistics: stats
    };
  }

  // Tạo link điểm danh cho học sinh
  async generateAttendanceLink(dto: GenerateAttendanceLinkDto, user: UserDocument) {
    let studentFallback: { fullName?: string; parentName?: string; age?: number; parentPhone?: string; studentCode?: string } | null = null;

    // Handle virtual classes from orders
    if (dto.classId.startsWith('virtual_')) {
      const classCode = dto.classId.replace('virtual_', '');
      const classes = await this.getClassesFromOrders(user);
      const virtualClass = classes.find(c => c.classCode === classCode);
      
      if (!virtualClass) {
        throw new NotFoundException('Không tìm thấy lớp học này');
      }
      
      const student = virtualClass.students.find(s => s.studentId === dto.studentId);
      if (!student) {
        throw new NotFoundException('Không tìm thấy học sinh trong lớp này');
      }

      studentFallback = {
        fullName: student.fullName,
        parentName: student.parentName,
        age: student.age,
        parentPhone: student.parentPhone,
        studentCode: student.studentCode,
      };

      const ensuredStudentId = await this.ensureStudentDocument({
        tentativeId: dto.studentId,
        studentCode: student.studentCode,
        fullName: student.fullName,
        parentName: student.parentName,
        parentPhone: student.parentPhone,
        age: student.age,
      });
      dto.studentId = ensuredStudentId;

      const realClassroom = await this.ensureClassroomForCode(classCode, user);
      dto.classId = realClassroom._id.toString();
    } else {
      // Handle real classes
      const { students } = await this.loadClassroomWithStudents(dto.classId, user, true);
      this.ensureStudentInClass(students, dto.studentId);
    }

    const attendanceDate = new Date(dto.date);
    attendanceDate.setHours(0, 0, 0, 0);

    // Tạo token unique
    const token = randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setHours(23, 59, 59, 999); // Hết hạn cuối ngày

    const attendanceDoc = await this.attendanceModel.findOneAndUpdate(
      {
        classId: dto.classId,
        studentId: dto.studentId,
        date: attendanceDate
      },
      {
        teacherId: user._id,
        status: AttendanceStatus.ABSENT_WITHOUT_PERMISSION,
        attendanceToken: token,
        tokenExpiresAt,
        imageUrl: null,
        attendedAt: null,
        sessionDuration: this.normalizeSessionDuration(),
        baseSessionsUsed: 0
      },
      {
        new: true,
        upsert: true
      }
    ).populate('studentId', 'fullName age parentName')
     .populate('classId', 'name code');

    const attendance = attendanceDoc?.toObject ? attendanceDoc.toObject() : attendanceDoc;

    if (studentFallback && attendance) {
      if (!attendance.studentId || !(attendance.studentId as any).fullName) {
        attendance.studentId = {
          _id: new Types.ObjectId(dto.studentId),
          fullName: studentFallback.fullName || 'Không xác định',
          age: studentFallback.age || 0,
          parentName: studentFallback.parentName || '',
        } as any;
      }
    }

    // Tạo URL điểm danh
    const attendanceUrl = `${process.env.FRONTEND_URL || 'http://localhost:4200'}/student-attendance/${token}`;

    return {
      attendance,
      attendanceUrl,
      token,
      expiresAt: tokenExpiresAt
    };
  }

  async getTeacherClassAssignments(user: UserDocument) {
    if (!this.isTeacher(user)) {
      throw new ForbiddenException('Chỉ giáo viên mới sử dụng chức năng này');
    }

    return this.getClassesFromOrders(user);
  }

  async getClassesFromOrders(user: UserDocument) {
    // Build filter based on user role
    const filter: Record<string, unknown> = {};
    
    if (this.isTeacher(user)) {
      const teacherId = this.getUserId(user);
      if (!teacherId || !Types.ObjectId.isValid(teacherId)) {
        return [];
      }
      filter.teacherId = new Types.ObjectId(teacherId);
    }

    // Get orders with classCode
    const orderFilter = { 
      ...filter, 
      classCode: { $exists: true, $ne: null }
    };
    const orders = await this.orderModel
      .find(orderFilter)
      .select('classId classCode studentId studentCode studentName parentName teacherId')
      .lean<OrderLean[]>();

    if (!orders.length) {
      return [];
    }

    // Group orders by classCode
    const classGroups = new Map<string, OrderLean[]>();
    
    for (const order of orders) {
      const classCode = this.normalizeStudentCode((order as any).classCode);
      if (!classCode) continue;
      
      if (!classGroups.has(classCode)) {
        classGroups.set(classCode, []);
      }
      classGroups.get(classCode)!.push(order);
    }

    // Get students for the orders  
    const studentIds = Array.from(new Set(
      orders.map(order => order.studentId?.toString()).filter(Boolean)
    ));
    const studentCodes = Array.from(new Set(
      orders.map(order => this.normalizeStudentCode((order as any).studentCode)).filter(Boolean)
    ));

    let [studentsById, studentsByCode] = await Promise.all([
      studentIds.length ? this.studentModel.find({ _id: { $in: studentIds } }).lean<StudentLean[]>() : [],
      studentCodes.length ? this.studentModel.find({ studentCode: { $in: studentCodes } }).lean<StudentLean[]>() : [],
    ]);

    // Try to find students from database using multiple methods
    console.log(`Found ${studentsById.length} students by ID, ${studentsByCode.length} students by code`);
    
    // Also try to find students by name matching from orders
    const studentNames = Array.from(new Set(
      orders.map(order => (order as any).studentName).filter(Boolean)
    ));
    
    const studentsByName = studentNames.length ? 
      await this.studentModel.find({ 
        fullName: { $in: studentNames } 
      }).lean<StudentLean[]>() : [];
    
    console.log(`Found ${studentsByName.length} students by name matching`);
    
    // Combine all found students
    const allFoundStudents = [...studentsById, ...studentsByCode, ...studentsByName];

    const studentMap = new Map<string, StudentLean>();
    allFoundStudents.forEach(student => {
      // Map by ID
      studentMap.set(student._id.toString(), student);
      
      // Map by student code
      const code = this.normalizeStudentCode(student.studentCode);
      if (code) {
        studentMap.set(`code_${code}`, student);
      }
      
      // Map by full name for better matching
      if (student.fullName) {
        studentMap.set(`name_${student.fullName}`, student);
      }
    });
    
    console.log(`Created student map with ${studentMap.size} entries`);

    // Build result
    const result: Array<{
      classId: string;
      classCode: string;
      className: string;
      studentCount: number;
      students: Array<{
        studentId: string;
        fullName: string;
        studentCode: string;
        age?: number;
        parentName?: string;
        parentPhone?: string;
      }>;
    }> = [];
    
    for (const [classCode, classOrders] of classGroups) {
      const studentsForClass = new Map<string, any>();
      
      for (const order of classOrders) {
        let student: StudentLean | null = null;
        
        // Try to find student by multiple methods
        if (order.studentId) {
          student = studentMap.get(order.studentId.toString()) || null;
        }
        
        // Try by student code
        if (!student) {
          const code = this.normalizeStudentCode((order as any).studentCode);
          if (code) {
            student = studentMap.get(`code_${code}`) || null;
          }
        }
        
        // Try by student name
        if (!student && (order as any).studentName) {
          student = studentMap.get(`name_${(order as any).studentName}`) || null;
        }
        
        // Create virtual student only if no real student found
        if (!student) {
          console.log(`No student found for order ${order._id}, creating virtual student`);
          const studentSeed = `${(order as any).studentName}_${this.normalizeStudentCode((order as any).studentCode)}_${classCode}`;
          student = {
            _id: this.generateConsistentId(studentSeed),
            fullName: (order as any).studentName || 'Học sinh không xác định',
            studentCode: this.normalizeStudentCode((order as any).studentCode) || '',
            age: 0,
            parentName: (order as any).parentName || 'Phụ huynh',
            parentPhone: '0000000000',
            faceImage: '',
            createdAt: new Date(),
            updatedAt: new Date(),
          } as StudentLean;
        } else {
          console.log(`Found real student: ${student.fullName} for order ${order._id}`);
        }
        
        if (student) {
          studentsForClass.set(student._id.toString(), {
            studentId: student._id.toString(),
            fullName: (student as any).fullName || (order as any).studentName || '',
            studentCode: this.normalizeStudentCode((student as any).studentCode) || this.normalizeStudentCode((order as any).studentCode) || '',
            age: (student as any).age,
            parentName: (student as any).parentName || (order as any).parentName,
            parentPhone: (student as any).parentPhone || (order as any).parentPhone || '',
          });
        }
      }
      
      result.push({
        classId: `virtual_${classCode}`,
        classCode: classCode,
        className: `Lớp ${classCode}`,
        studentCount: studentsForClass.size,
        students: Array.from(studentsForClass.values()).sort((a, b) =>
          a.fullName.localeCompare(b.fullName, 'vi', { sensitivity: 'base' })
        ),
      });
    }

    return result.sort((a, b) =>
      a.classCode.localeCompare(b.classCode, 'vi', { sensitivity: 'base' })
    );
  }



  // Lấy thông tin điểm danh từ token (public endpoint)
  async getAttendanceByToken(token: string) {
    const attendance = await this.attendanceModel.findOne({ attendanceToken: token })
      .populate('studentId', 'fullName age parentName')
      .populate('classId', 'name code')
      .populate('teacherId', 'fullName email')
      .lean();

    if (!attendance) {
      throw new NotFoundException('Link điểm danh không hợp lệ');
    }

    // Kiểm tra token đã hết hạn chưa
    if (attendance.tokenExpiresAt && new Date() > attendance.tokenExpiresAt) {
      throw new BadRequestException('Link điểm danh đã hết hạn');
    }

    // Kiểm tra đã điểm danh chưa
    if (attendance.attendedAt) {
      throw new BadRequestException('Đã điểm danh rồi, không thể điểm danh lại');
    }

    return attendance;
  }

  // Xử lý điểm danh từ học sinh (public endpoint)
  async submitStudentAttendance(dto: StudentAttendanceDto) {
    const attendance = await this.attendanceModel.findOne({ attendanceToken: dto.token });

    if (!attendance) {
      throw new NotFoundException('Link điểm danh không hợp lệ');
    }

    // Kiểm tra token đã hết hạn chưa
    if (attendance.tokenExpiresAt && new Date() > attendance.tokenExpiresAt) {
      throw new BadRequestException('Link điểm danh đã hết hạn');
    }

    // Kiểm tra đã điểm danh chưa
    if (attendance.attendedAt) {
      throw new BadRequestException('Đã điểm danh rồi, không thể điểm danh lại');
    }

    // Xử lý lưu ảnh
    const imageBuffer = Buffer.from(dto.imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    const imageName = `attendance_${attendance._id}_${Date.now()}.jpg`;
    const uploadsDir = join(process.cwd(), 'uploads', 'attendance');
    const imagePath = join(uploadsDir, imageName);
    
    // Tạo thư mục nếu chưa tồn tại
    const { mkdir } = await import('fs/promises');
    await mkdir(uploadsDir, { recursive: true });
    
    // Lưu file
    await writeFile(imagePath, imageBuffer);

    // Cập nhật bản ghi điểm danh
    const sessionDuration = this.normalizeSessionDuration(attendance.sessionDuration as any);
    attendance.status = AttendanceStatus.PRESENT;
    attendance.sessionDuration = sessionDuration;
    attendance.baseSessionsUsed = this.computeBaseSessionsUsed(attendance.status, sessionDuration);
    attendance.imageUrl = `/uploads/attendance/${imageName}`;
    attendance.attendedAt = new Date();
    await attendance.save();

    const saved = await this.attendanceModel.findById(attendance._id)
      .populate('studentId', 'fullName age parentName')
      .populate('classId', 'name code')
      .populate('teacherId', 'fullName email')
      .lean();

    await this.syncOrderAttendance(attendance.classId.toString(), [attendance.studentId.toString()]);

    return saved;
  }

  // Lấy báo cáo điểm danh tổng hợp
  async getAttendanceReport(startDate: string, endDate: string, classId?: string) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const filter: any = {
      date: { $gte: start, $lte: end },
      attendedAt: { $ne: null } // Chỉ lấy những bản ghi đã điểm danh thực tế
    };

    if (classId) {
      if (!Types.ObjectId.isValid(classId)) {
        throw new BadRequestException('classId không hợp lệ');
      }
      filter.classId = new Types.ObjectId(classId);
    }

    const attendances = await this.attendanceModel.find(filter)
      .populate('studentId', 'fullName age parentName faceImage')
      .populate('classId', 'name code teachers')
      .populate('teacherId', 'fullName email')
      .sort({ attendedAt: -1 })
      .lean();

    // Đính kèm lương buổi dựa trên lớp + giáo viên + thời lượng
    return attendances.map((att) => {
      const classroom = (att as any).classId as any;
      return this.attachSalary(att, classroom);
    });
  }
}