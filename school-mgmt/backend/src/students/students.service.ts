import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Student, StudentDocument } from './schemas/student.schema';
import { CreateStudentDto } from './dto/create-student.dto';
import { UpdateStudentDto } from './dto/update-student.dto';
import { UserDocument } from '../users/schemas/user.schema';
import { Role } from '../common/interfaces/role.enum';

@Injectable()
export class StudentsService {
  constructor(@InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>) {}

  create(dto: CreateStudentDto, actor: UserDocument) {
    const entity = new this.studentModel({ ...dto, createdBy: actor._id });
    return entity.save();
  }

  findAll(actor: UserDocument) {
    const filter = actor.role === Role.DIRECTOR ? {} : { createdBy: actor._id };
    return this.studentModel.find(filter).sort({ createdAt: -1 }).lean();
  }

  async update(id: string, dto: UpdateStudentDto) {
    const updated = await this.studentModel.findByIdAndUpdate(id, dto, { new: true }).lean();
    if (!updated) throw new NotFoundException('Student not found');
    return updated as Student;
  }

  async remove(id: string) {
    const deleted = await this.studentModel.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException('Student not found');
    return deleted as Student;
  }
}
