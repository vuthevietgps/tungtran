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

  async create(createStudentDto: any) {
    const student = new this.studentModel(createStudentDto);
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
