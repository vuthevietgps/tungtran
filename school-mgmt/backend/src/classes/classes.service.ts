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
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Role } from '../common/interfaces/role.enum';
import { ClassType } from './schemas/class.schema';

@Injectable()
export class ClassesService {
  constructor(
    @InjectModel(Classroom.name) private readonly classModel: Model<ClassDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
  ) {}

  async create(dto: CreateClassDto, actor?: UserDocument) {
    if (actor?.role === Role.SALE && dto.classType === ClassType.OFFLINE) {
      throw new BadRequestException('SALE không được tạo lớp OFFLINE');
    }
    await this.ensureCodeUnique(dto.code);
    const payload = await this.buildPayload(dto);
    const created = await new this.classModel(payload).save();
    return this.findByIdPopulated(created._id);
  }

  async findAll(actor: UserDocument) {
    let filter = {};
    
    if (actor.role === Role.TEACHER) {
      filter = { 'teachers.teacherId': actor._id };
    }
    // DIRECTOR có thể xem tất cả lớp (filter rỗng)
    
    const classrooms = await this.classModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate('teachers.teacherId', 'fullName email role')
      .populate('students', 'fullName age parentName')
      .lean();
    
    return classrooms.map(classroom => ({
      ...classroom,
      studentCount: classroom.students?.length || 0,
    }));
  }

  async update(id: string, dto: UpdateClassDto, actor?: UserDocument) {
    const existing = await this.classModel.findById(id).lean();
    if (!existing) throw new NotFoundException('Class not found');

    const isSale = actor?.role === Role.SALE;
    const isOffline = existing.classType === ClassType.OFFLINE;

    if (isSale && isOffline) {
      // Sale chỉ được thêm học viên offline của mình: chỉ cho phép cập nhật students
      const update: Record<string, unknown> = {};
      if (dto.studentIds) {
        update.students = await this.validateStudents(dto.studentIds);
      }
      await this.classModel.findByIdAndUpdate(id, update, { new: true }).lean();
      return this.findByIdPopulated(id);
    }

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

    const deleted = await this.classModel.findByIdAndDelete(id).lean();
    return deleted;
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

    // Handle classType early so teacher validation can rely on it
    if (!allowPartial || (dto as any).classType) {
      payload.classType = (dto as any).classType;
    }

    if (!allowPartial || (dto as any).teachers) {
      const teachers = (dto as any).teachers ?? [];
      if (teachers.length > 10) {
        throw new BadRequestException('Không được phân công quá 10 giáo viên');
      }
      const typeForValidation = (dto as any).classType ?? payload.classType;
      payload.teachers = await this.validateTeachersWithSalaries(teachers, typeForValidation as ClassType);
    }

    if (!allowPartial || dto.studentIds) {
      const ids = dto.studentIds ?? [];
      payload.students = await this.validateStudents(ids);
    }

    if (!allowPartial || dto.name) payload.name = dto.name;
    if (!allowPartial || dto.code) payload.code = dto.code?.toUpperCase();

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

  private async validateTeachersWithSalaries(
    teachers: {
      teacherId: string;
      salary0?: number;
      salary1?: number;
      salary2?: number;
      salary3?: number;
      salary4?: number;
      salary5?: number;
      offlineSalary1?: number;
      offlineSalary2?: number;
      offlineSalary3?: number;
      offlineSalary4?: number;
      canCreateAttendanceLink?: boolean;
    }[],
    classType?: ClassType,
  ): Promise<{
    teacherId: Types.ObjectId;
    salary0: number;
    salary1: number;
    salary2: number;
    salary3: number;
    salary4: number;
    salary5: number;
    offlineSalary1: number;
    offlineSalary2: number;
    offlineSalary3: number;
    offlineSalary4: number;
    canCreateAttendanceLink: boolean;
  }[]> {
    if (!teachers?.length) return [];
    if (!classType) throw new BadRequestException('Thiếu loại lớp');
    
    // Validate all teacher IDs
    const teacherIds = teachers.map(t => t.teacherId);
    const found = await this.userModel.find({ _id: { $in: teacherIds }, role: Role.TEACHER }, '_id').lean();
    if (found.length !== teacherIds.length) {
      throw new BadRequestException('Một số giáo viên không hợp lệ');
    }
    
    if (classType === ClassType.ONLINE) {
      return teachers.map((t) => {
        const salary0 = this.toNonNegativeNumber(t.salary0);
        const salary1 = this.toNonNegativeNumber(t.salary1);
        const salary2 = this.toNonNegativeNumber(t.salary2);
        const salary3 = this.toNonNegativeNumber(t.salary3);
        const salary4 = this.toNonNegativeNumber(t.salary4);
        const salary5 = this.toNonNegativeNumber(t.salary5);
        return {
          teacherId: new Types.ObjectId(t.teacherId),
          salary0,
          salary1,
          salary2,
          salary3,
          salary4,
          salary5,
          offlineSalary1: 0,
          offlineSalary2: 0,
          offlineSalary3: 0,
          offlineSalary4: 0,
          canCreateAttendanceLink: !!t.canCreateAttendanceLink,
        };
      });
    }

    return teachers.map((t) => {
      const offlineSalary1 = Math.max(0, Number(t.offlineSalary1) || 0);
      const offlineSalary2 = Math.max(0, Number(t.offlineSalary2) || 0);
      const offlineSalary3 = Math.max(0, Number(t.offlineSalary3) || 0);
      const offlineSalary4 = Math.max(0, Number(t.offlineSalary4) || 0);
      return {
        teacherId: new Types.ObjectId(t.teacherId),
        salary0: 0,
        salary1: 0,
        salary2: 0,
        salary3: 0,
        salary4: 0,
        salary5: 0,
        offlineSalary1,
        offlineSalary2,
        offlineSalary3,
        offlineSalary4,
        canCreateAttendanceLink: !!t.canCreateAttendanceLink,
      };
    });
  }

  private toNonNegativeNumber(value?: number) {
    const num = Number(value);
    return Number.isFinite(num) && num >= 0 ? num : 0;
  }
  private async findByIdPopulated(id: string | Types.ObjectId) {
    const classroom = await this.classModel
      .findById(id)
      .populate('teachers.teacherId', 'fullName email role')
      .populate('students', 'fullName age parentName')
      .lean();
    
    if (classroom) {
      return {
        ...classroom,
        studentCount: classroom.students?.length || 0,
      };
    }
    
    return classroom;
  }
}
