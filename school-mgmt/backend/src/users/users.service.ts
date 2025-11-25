import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '../common/interfaces/role.enum';
import { UserStatus } from '../common/interfaces/user-status.enum';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async hashPassword(plain: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(plain, salt);
  }

  async createByDirector(dto: CreateUserDto, actor: UserDocument): Promise<User> {
    if (actor.role !== Role.DIRECTOR) throw new ForbiddenException('Only director');
    const existed = await this.userModel.findOne({ email: dto.email }).lean();
    if (existed) throw new ConflictException('Email already exists');
    const password = await this.hashPassword(dto.password);
    const user = new this.userModel({ ...dto, password });
    return user.save();
  }

  async findAll(): Promise<User[]> {
    return this.userModel.find().lean();
  }

  async findByRole(role: Role): Promise<User[]> {
    return this.userModel.find({ role }).lean();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findById(id: string): Promise<User> {
    const user = await this.userModel.findById(id).lean();
    if (!user) throw new NotFoundException('User not found');
    return user as any;
  }

  async updateByDirector(id: string, dto: UpdateUserDto, actor: UserDocument): Promise<User> {
    if (actor.role !== Role.DIRECTOR) throw new ForbiddenException('Only director');
    const update: any = { ...dto };
    if (dto.password) {
      update.password = await this.hashPassword(dto.password);
    }
    const user = await this.userModel.findByIdAndUpdate(id, update, { new: true }).lean();
    if (!user) throw new NotFoundException('User not found');
    return user as any;
  }

  async lock(id: string, actor: UserDocument): Promise<User> {
    if (actor.role !== Role.DIRECTOR) throw new ForbiddenException('Only director');
    const user = await this.userModel
      .findByIdAndUpdate(id, { status: UserStatus.LOCKED }, { new: true })
      .lean();
    if (!user) throw new NotFoundException('User not found');
    return user as any;
  }

  async unlock(id: string, actor: UserDocument): Promise<User> {
    if (actor.role !== Role.DIRECTOR) throw new ForbiddenException('Only director');
    const user = await this.userModel
      .findByIdAndUpdate(id, { status: UserStatus.ACTIVE }, { new: true })
      .lean();
    if (!user) throw new NotFoundException('User not found');
    return user as any;
  }

  async removeByDirector(id: string, actor: UserDocument): Promise<User> {
    if (actor.role !== Role.DIRECTOR) throw new ForbiddenException('Only director');
    if (actor._id?.toString() === id) throw new ForbiddenException('Cannot delete yourself');
    const deleted = await this.userModel.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException('User not found');
    return deleted as any;
  }
}
