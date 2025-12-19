import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHash } from 'crypto';
import { Student, StudentDocument } from './schemas/student.schema';
import { StudentSequence, StudentSequenceDocument } from './schemas/student-sequence.schema';
import { Attendance, AttendanceDocument, AttendanceStatus } from '../attendance/schemas/attendance.schema';
import { Classroom, ClassroomDocument } from '../classes/schemas/class.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

type StudentLean = Student & { _id: Types.ObjectId };
type OrderLean = Order & { _id: Types.ObjectId };

@Injectable()
export class StudentsService {
  constructor(
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(StudentSequence.name) private readonly studentSeqModel: Model<StudentSequenceDocument>,
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Classroom.name) private readonly classroomModel: Model<ClassroomDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  private calculatePaidSessions70(student: any): number {
    // Sale nhập số buổi 70p đã mua (sessionsRegistered/sessionsCollected), chỉ tính các payment đã được duyệt
    const payments = (student as any).payments || [];
    return payments
      .filter((p: any) => (p.confirmStatus || 'PENDING') === 'CONFIRMED')
      .reduce((sum: number, p: any) => {
        const sessions = p.sessionsCollected ?? p.sessionsRegistered ?? 0;
        const duration = Number(p.sessionDuration) || 70;
        const minutes = (Number.isFinite(sessions) ? Number(sessions) : 0) * duration;
        const sessions70 = minutes / 70;
        return sum + (Number.isFinite(sessions70) ? sessions70 : 0);
      }, 0);
  }

  private async buildConsumedMinutesMap(studentIds: Types.ObjectId[]): Promise<Map<string, number>> {
    if (!studentIds.length) return new Map();

    const pipeline = [
      {
        $match: {
          studentId: { $in: studentIds },
          status: { $in: [AttendanceStatus.PRESENT, AttendanceStatus.LATE] }
        }
      },
      {
        $addFields: {
          usedMinutes: { $ifNull: ['$sessionDuration', 70] }
        }
      },
      {
        $group: {
          _id: '$studentId',
          totalUsedMinutes: { $sum: '$usedMinutes' }
        }
      }
    ];

    const rows = await this.attendanceModel.aggregate(pipeline);
    return new Map(rows.map((row: any) => [row._id.toString(), row.totalUsedMinutes]));
  }

  findAll() {
    return this.buildStudentListFromOrders();
  }

  private async buildStudentListFromOrders() {
    const [studentsFromDb, orders] = await Promise.all([
      this.studentModel.find()
        .populate('productPackage', 'name price')
        .sort({ createdAt: -1 })
        .lean<StudentLean[]>(),
      this.orderModel.find({ studentName: { $exists: true, $ne: '' } })
        .sort({ createdAt: -1 })
        .lean<OrderLean[]>(),
    ]);

    const studentMap = new Map<string, any>();

    const pushStudent = (student: any) => {
      const normalizedCode = this.normalizeStudentCode(student.studentCode);
      const key = normalizedCode || student._id;
      if (!key) return;
      studentMap.set(key, student);
    };

    studentsFromDb.forEach(student => pushStudent(this.mapStudentDocument(student)));

    for (const order of orders) {
      const normalizedCode = this.normalizeStudentCode(order.studentCode);
      if (!normalizedCode || studentMap.has(normalizedCode)) continue;
      pushStudent(this.mapOrderStudent(order));
    }

    const studentsArray = Array.from(studentMap.values()).sort((a, b) =>
      a.fullName.localeCompare(b.fullName, 'vi', { sensitivity: 'base' })
    );

    const validObjectIds = studentsArray
      .map((s) => (s as any)._id?.toString?.())
      .filter((id): id is string => !!id && Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    const consumedMinutesMap = await this.buildConsumedMinutesMap(validObjectIds);

    for (const student of studentsArray) {
      const id = (student as any)._id?.toString?.();
      if (!id || !Types.ObjectId.isValid(id)) continue;

      const basePaid70 = this.calculatePaidSessions70(student); // số buổi 70p đã mua
      const paidMinutes = basePaid70 * 70;
      const usedMinutes = consumedMinutesMap.get(id) || 0;
      const remainingMinutes = Math.max(0, paidMinutes - usedMinutes);

      const toRemaining = (target: number) => Math.floor(remainingMinutes / target);

      (student as any).sessionBalances = {
        basePaid70,
        baseUsed70: usedMinutes / 70,
        remaining70Exact: Number((remainingMinutes / 70).toFixed(3)),
        remaining70: Math.floor(remainingMinutes / 70),
        remaining50: toRemaining(50),
        remaining40: toRemaining(40),
        remaining90: toRemaining(90),
        remaining110: toRemaining(110),
        remaining120: toRemaining(120),
        remaining150: toRemaining(150),
      };
    }

    return studentsArray;
  }

  private mapStudentDocument(student: StudentLean) {
    const productPackage = student.productPackage as any;
    return {
      _id: student._id.toString(),
      studentCode: student.studentCode,
      fullName: student.fullName,
      dateOfBirth: student.dateOfBirth ? student.dateOfBirth.toISOString() : undefined,
      age: student.age,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      faceImage: student.faceImage,
      level: (student as any).level,
      studentType: (student as any).studentType,
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

  private mapOrderStudent(order: OrderLean) {
    const normalizedCode = this.normalizeStudentCode(order.studentCode) || 'UNKNOWN';
    return {
      _id: order.studentId?.toString() || this.generateVirtualId(`${normalizedCode}_${order._id}`),
      studentCode: normalizedCode,
      fullName: order.studentName || 'Chưa cập nhật',
      age: (order as any).age || 0,
      parentName: order.parentName || 'Chưa cập nhật',
      parentPhone: (order as any).parentPhone || '',
      faceImage: (order as any).faceImage || '',
      studentType: (order as any).studentType,
      productPackage: undefined,
    };
  }

  private normalizeStudentCode(code?: string | null) {
    if (!code) return null;
    const trimmed = code.trim();
    return trimmed ? trimmed.toUpperCase() : null;
  }

  private generateVirtualId(seed: string) {
    const hash = createHash('md5').update(seed).digest('hex').slice(0, 24);
    return new Types.ObjectId(hash).toHexString();
  }

  private extractSaleCode(email?: string | null): string {
    if (!email) return 'SALE';
    const prefix = email.split('@')[0] || 'SALE';
    const cleaned = prefix.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return cleaned || 'SALE';
  }

  private async generateStudentCode(saleCode: string): Promise<string> {
    const seq = await this.studentSeqModel.findOneAndUpdate(
      { saleCode },
      { $inc: { current: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    const padded = String(seq.current).padStart(4, '0');
    return `${saleCode}-${padded}`;
  }

  async getStudentReport(classId?: string, searchTerm?: string) {
    // Build filter for students
    const studentFilter: any = {};
    if (searchTerm) {
      studentFilter.$or = [
        { fullName: { $regex: searchTerm, $options: 'i' } },
        { parentName: { $regex: searchTerm, $options: 'i' } },
        { parentPhone: { $regex: searchTerm, $options: 'i' } }
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
    const attendanceCounts = await this.attendanceModel.aggregate([
      {
        $match: {
          studentId: { $in: studentIds },
          attendedAt: { $ne: null }
        }
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

  async create(createStudentDto: any, actor?: any) {
    const { saleId } = createStudentDto;
    const saleUser = saleId ? await this.userModel.findById(saleId) : null;
    const saleCode = this.extractSaleCode(saleUser?.email || actor?.email);
    const studentCode = await this.generateStudentCode(saleCode);

    const payload = {
      ...createStudentDto,
      studentCode,
      saleCode,
    };

    const student = new this.studentModel(payload);
    return student.save();
  }

  async update(id: string, updateStudentDto: any) {
    return this.studentModel.findByIdAndUpdate(id, updateStudentDto, { new: true });
  }

  async remove(id: string) {
    try {
      console.log('=== DELETE STUDENT REQUEST ===');
      console.log('Student ID:', id);
      
      // Check if student exists in DB
      const existingStudent = await this.studentModel.findById(id);
      console.log('Student exists in DB:', !!existingStudent);
      
      let deletedCount = 0;
      
      if (existingStudent) {
        console.log('Student code:', existingStudent.studentCode);
        console.log('Student name:', existingStudent.fullName);
        
        // Delete related data first
        const studentObjectId = new Types.ObjectId(id);
        
        // Delete attendance records
        const attendanceResult = await this.attendanceModel.deleteMany({ studentId: studentObjectId });
        console.log('Deleted attendance records:', attendanceResult.deletedCount);
        
        // Delete order records  
        const orderResult = await this.orderModel.deleteMany({ studentId: studentObjectId });
        console.log('Deleted order records:', orderResult.deletedCount);
        
        // Finally delete the student
        const result = await this.studentModel.findByIdAndDelete(id);
        console.log('Deleted student from DB');
        deletedCount++;
      } else {
        // This is a virtual student from orders - try to delete by studentId in orders
        console.log('Virtual student detected - searching in orders...');
        const orderResult = await this.orderModel.deleteMany({ studentId: new Types.ObjectId(id) });
        console.log('Deleted orders with studentId:', orderResult.deletedCount);
        deletedCount += orderResult.deletedCount;
        
        // If no orders found by ID, this student might not exist at all
        if (orderResult.deletedCount === 0) {
          console.log('No records found to delete');
        }
      }
      
      console.log('=== DELETE COMPLETED ===');
      console.log('Total records affected:', deletedCount);
      
      return { deletedCount };
    } catch (error) {
      console.error('Error deleting student:', error);
      throw error;
    }
  }

  async findOne(id: string) {
    return this.studentModel.findById(id).populate('productPackage', 'name price');
  }

  async approve(id: string, action: 'APPROVE' | 'REJECT', userId: string) {
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

  async clearAllStudentData() {
    // Delete all students
    await this.studentModel.deleteMany({});
    
    // Delete all related attendance records
    await this.attendanceModel.deleteMany({});
    
    // Delete all orders (if they reference students)
    await this.orderModel.deleteMany({});
    
    return { message: 'All student data cleared successfully' };
  }
}
