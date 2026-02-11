import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '../common/interfaces/role.enum';
import { UserStatus } from '../common/interfaces/user-status.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async hashPassword(plain: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(plain, salt);
  }

  async createByDirector(dto: CreateUserDto, actor: JwtPayload): Promise<User> {
    if (actor.role !== Role.DIRECTOR) throw new ForbiddenException('Chỉ giám đốc mới có quyền');
    const existed = await this.userModel.findOne({ email: dto.email }).lean();
    if (existed) throw new ConflictException('Email đã tồn tại');
    const password = await this.hashPassword(dto.password);
    const user = new this.userModel({ ...dto, password });
    const saved = await user.save();
    const { password: _pw, ...result } = saved.toObject();
    return result as any;
  }

  async findAll(): Promise<User[]> {
    return this.userModel.find().select('-password').lean();
  }

  async findByRole(role: Role): Promise<User[]> {
    return this.userModel.find({ role }).select('-password').lean();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findById(id: string): Promise<User> {
    const user = await this.userModel.findById(id).select('-password').lean();
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return user as any;
  }

  async updateByDirector(id: string, dto: UpdateUserDto, actor: JwtPayload): Promise<User> {
    if (actor.role !== Role.DIRECTOR) throw new ForbiddenException('Chỉ giám đốc mới có quyền');
    // Check email uniqueness if changing email
    if (dto.email) {
      const existing = await this.userModel.findOne({ email: dto.email, _id: { $ne: id } }).lean();
      if (existing) throw new ConflictException('Email đã tồn tại');
    }
    const update: any = { ...dto };
    if (dto.password) {
      update.password = await this.hashPassword(dto.password);
    }
    const user = await this.userModel.findByIdAndUpdate(id, update, { new: true }).select('-password').lean();
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return user as any;
  }

  async lock(id: string, actor: JwtPayload): Promise<User> {
    if (actor.role !== Role.DIRECTOR) throw new ForbiddenException('Chỉ giám đốc mới có quyền');
    if (actor.sub === id) throw new ForbiddenException('Không thể khóa chính mình');
    const user = await this.userModel
      .findByIdAndUpdate(id, { status: UserStatus.LOCKED }, { new: true })
      .select('-password')
      .lean();
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return user as any;
  }

  async unlock(id: string, actor: JwtPayload): Promise<User> {
    if (actor.role !== Role.DIRECTOR) throw new ForbiddenException('Chỉ giám đốc mới có quyền');
    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        { status: UserStatus.ACTIVE, failedLoginAttempts: 0, $unset: { lastFailedLoginAt: 1 } },
        { new: true },
      )
      .select('-password')
      .lean();
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return user as any;
  }

  async removeByDirector(id: string, actor: JwtPayload): Promise<User> {
    if (actor.role !== Role.DIRECTOR) throw new ForbiddenException('Chỉ giám đốc mới có quyền');
    if (actor.sub === id) throw new ForbiddenException('Không thể xóa chính mình');
    const deleted = await this.userModel.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException('Không tìm thấy người dùng');
    return deleted as any;
  }
}
