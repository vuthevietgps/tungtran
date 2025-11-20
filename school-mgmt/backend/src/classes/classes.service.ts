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

@Injectable()
export class ClassesService {
  constructor(
    @InjectModel(Classroom.name) private readonly classModel: Model<ClassDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
  ) {}

  async create(dto: CreateClassDto) {
    await this.ensureCodeUnique(dto.code);
    const payload = await this.buildPayload(dto);
    const created = await new this.classModel(payload).save();
    return this.findByIdPopulated(created._id);
  }

  async findAll(actor: UserDocument) {
    const filter = actor.role === Role.SALE ? { sale: actor._id } : {};
    return this.classModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate('teacher', 'fullName email role')
      .populate('sale', 'fullName email role')
      .populate('students', 'fullName age parentName')
      .lean();
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
    const deleted = await this.classModel.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException('Class not found');
    return deleted;
  }

  async assignStudentsBySale(id: string, dto: AssignStudentsDto, actor: UserDocument) {
    if (actor.role !== Role.SALE) throw new ForbiddenException('Only sale role allowed');
    const classroom = await this.classModel.findById(id).lean();
    if (!classroom) throw new NotFoundException('Class not found');
    if (classroom.sale?.toString() !== actor._id.toString()) {
      throw new ForbiddenException('Bạn không phụ trách lớp này');
    }
    const studentIds = dto.studentIds || [];
    if (!studentIds.length) throw new BadRequestException('Vui lòng chọn học viên');
    const valid = await this.studentModel
      .find({ _id: { $in: studentIds }, createdBy: actor._id }, '_id')
      .lean();
    if (valid.length !== studentIds.length) {
      throw new BadRequestException('Chỉ được thêm học viên do bạn tạo');
    }
    const merged = Array.from(
      new Set([...(classroom.students?.map((s: any) => s.toString()) || []), ...studentIds])
    ).map((sid) => new Types.ObjectId(sid));
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

    if (!allowPartial || dto.saleId) {
      const saleId = dto.saleId ?? null;
      if (!saleId) throw new BadRequestException('Sale is required');
      payload.sale = await this.validateUserRole(saleId, Role.SALE);
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

  private async findByIdPopulated(id: string | Types.ObjectId) {
    return this.classModel
      .findById(id)
      .populate('teacher', 'fullName email role')
      .populate('sale', 'fullName email role')
      .populate('students', 'fullName age parentName')
      .lean();
  }
}
