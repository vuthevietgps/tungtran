import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private normalizeUserCode(code?: string | null): string | null {
    if (!code) return null;
    const normalized = code.trim().toUpperCase();
    return normalized || null;
  }

  private normalizeOptionalText(value?: string | null): string | null {
    if (value === undefined || value === null) return null;
    const normalized = value.trim();
    return normalized || null;
  }

  private async ensureEmailUnique(email: string, excludeId?: string): Promise<void> {
    const query: any = { email };
    if (excludeId) query._id = { $ne: excludeId };
    const existing = await this.userModel.findOne(query).lean();
    if (existing) throw new ConflictException('Email da ton tai');
  }

  private async ensureUserCodeUnique(userCode: string, excludeId?: string): Promise<void> {
    const query: any = { userCode };
    if (excludeId) query._id = { $ne: excludeId };
    const existing = await this.userModel.findOne(query).lean();
    if (existing) throw new ConflictException('Ma tai khoan da ton tai');
  }

  async createByDirector(dto: CreateUserDto, actor: JwtPayload): Promise<User> {
    if (actor.role !== Role.DIRECTOR) throw new ForbiddenException('Chi giam doc moi co quyen');

    const email = this.normalizeEmail(dto.email);
    const userCode = this.normalizeUserCode(dto.userCode);
    const facebookLink = this.normalizeOptionalText(dto.facebookLink);
    const address = this.normalizeOptionalText(dto.address);
    const isParent = dto.role === Role.PARENT;
    if (!userCode) throw new BadRequestException('Ma tai khoan la bat buoc');

    await this.ensureEmailUnique(email);
    await this.ensureUserCodeUnique(userCode);

    const password = await this.hashPassword(dto.password);
    const user = new this.userModel({
      ...dto,
      email,
      userCode,
      password,
      facebookLink: isParent ? (facebookLink || undefined) : undefined,
      address: isParent ? (address || undefined) : undefined,
    });

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
    return this.userModel.findOne({ email: this.normalizeEmail(email) }).exec();
  }

  async findById(id: string): Promise<User> {
    const user = await this.userModel.findById(id).select('-password').lean();
    if (!user) throw new NotFoundException('Khong tim thay nguoi dung');
    return user as any;
  }

  async updateByDirector(id: string, dto: UpdateUserDto, actor: JwtPayload): Promise<User> {
    if (actor.role !== Role.DIRECTOR) throw new ForbiddenException('Chi giam doc moi co quyen');

    const update: any = {};
    const unset: Record<string, 1> = {};

    if (dto.email !== undefined) {
      const email = this.normalizeEmail(dto.email);
      await this.ensureEmailUnique(email, id);
      update.email = email;
    }

    if (dto.userCode !== undefined) {
      const userCode = this.normalizeUserCode(dto.userCode);
      if (!userCode) throw new BadRequestException('Ma tai khoan khong duoc de trong');
      await this.ensureUserCodeUnique(userCode, id);
      update.userCode = userCode;
    }

    if (dto.fullName !== undefined) update.fullName = dto.fullName;
    if (dto.role !== undefined) update.role = dto.role;

    if (dto.facebookLink !== undefined) {
      const facebookLink = this.normalizeOptionalText(dto.facebookLink);
      if (facebookLink) update.facebookLink = facebookLink;
      else unset.facebookLink = 1;
    }

    if (dto.address !== undefined) {
      const address = this.normalizeOptionalText(dto.address);
      if (address) update.address = address;
      else unset.address = 1;
    }

    if (dto.role !== undefined && dto.role !== Role.PARENT) {
      unset.facebookLink = 1;
      unset.address = 1;
      delete update.facebookLink;
      delete update.address;
    }

    if (dto.password) {
      update.password = await this.hashPassword(dto.password);
    }

    if (Object.keys(unset).length) {
      update.$unset = unset;
    }

    const user = await this.userModel.findByIdAndUpdate(id, update, { new: true }).select('-password').lean();
    if (!user) throw new NotFoundException('Khong tim thay nguoi dung');
    return user as any;
  }

  async lock(id: string, actor: JwtPayload): Promise<User> {
    if (actor.role !== Role.DIRECTOR) throw new ForbiddenException('Chi giam doc moi co quyen');
    if (actor.sub === id) throw new ForbiddenException('Khong the khoa chinh minh');
    const user = await this.userModel
      .findByIdAndUpdate(id, { status: UserStatus.LOCKED }, { new: true })
      .select('-password')
      .lean();
    if (!user) throw new NotFoundException('Khong tim thay nguoi dung');
    return user as any;
  }

  async unlock(id: string, actor: JwtPayload): Promise<User> {
    if (actor.role !== Role.DIRECTOR) throw new ForbiddenException('Chi giam doc moi co quyen');
    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        { status: UserStatus.ACTIVE, failedLoginAttempts: 0, $unset: { lastFailedLoginAt: 1 } },
        { new: true },
      )
      .select('-password')
      .lean();
    if (!user) throw new NotFoundException('Khong tim thay nguoi dung');
    return user as any;
  }

  async removeByDirector(id: string, actor: JwtPayload): Promise<User> {
    if (actor.role !== Role.DIRECTOR) throw new ForbiddenException('Chi giam doc moi co quyen');
    if (actor.sub === id) throw new ForbiddenException('Khong the xoa chinh minh');
    const deleted = await this.userModel.findByIdAndDelete(id).lean();
    if (!deleted) throw new NotFoundException('Khong tim thay nguoi dung');
    return deleted as any;
  }
}
