import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { createHash } from 'crypto';
import { Student, StudentDocument } from './schemas/student.schema';
import { Attendance, AttendanceDocument } from '../attendance/schemas/attendance.schema';
import { Classroom, ClassroomDocument } from '../classes/schemas/class.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';

type StudentLean = Student & { _id: Types.ObjectId };
type OrderLean = Order & { _id: Types.ObjectId };

@Injectable()
export class StudentsService {
  constructor(
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Attendance.name) private readonly attendanceModel: Model<AttendanceDocument>,
    @InjectModel(Classroom.name) private readonly classroomModel: Model<ClassroomDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
  ) {}

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

    return Array.from(studentMap.values()).sort((a, b) =>
      a.fullName.localeCompare(b.fullName, 'vi', { sensitivity: 'base' })
    );
  }

  private mapStudentDocument(student: StudentLean) {
    const productPackage = student.productPackage as any;
    return {
      _id: student._id.toString(),
      studentCode: student.studentCode,
      fullName: student.fullName,
      age: student.age,
      parentName: student.parentName,
      parentPhone: student.parentPhone,
      faceImage: student.faceImage,
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
}
