import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UsersService } from '../users/users.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

const MAX_FAILED_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async validateUser(email: string, pass: string) {
    const user = await this.usersService.findByEmail(email.toLowerCase());
    if (!user) throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ');
    if (!user.password) throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ');
    if (user.status === 'LOCKED') throw new UnauthorizedException('Tài khoản đã bị khóa');

    const match = await bcrypt.compare(pass, user.password);
    if (!match) {
      // Track failed attempts atomically
      const updateOps: any = {
        $inc: { failedLoginAttempts: 1 },
        $set: { lastFailedLoginAt: new Date() },
      };
      const updated = await this.userModel.findOneAndUpdate(
        { _id: user._id },
        updateOps,
        { new: true },
      );
      // Auto-lock after MAX_FAILED_ATTEMPTS
      if (updated && updated.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        await this.userModel.updateOne({ _id: user._id }, { $set: { status: 'LOCKED' } });
      }
      throw new UnauthorizedException('Thông tin đăng nhập không hợp lệ');
    }

    // Reset failed attempts on successful login
    if (user.failedLoginAttempts > 0) {
      await this.userModel.updateOne(
        { _id: user._id },
        { $set: { failedLoginAttempts: 0 }, $unset: { lastFailedLoginAt: 1 } },
      );
    }

    const { password, failedLoginAttempts, lastFailedLoginAt, ...result } = user.toObject();
    return result;
  }

  async login(user: any) {
    const payload = { sub: user._id, email: user.email, role: user.role, fullName: user.fullName };
    return {
      access_token: await this.jwtService.signAsync(payload),
      user: payload,
    };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const userDoc = await this.userModel.findById(userId);
    if (!userDoc) throw new UnauthorizedException('Người dùng không tồn tại');

    const match = await bcrypt.compare(oldPassword, userDoc.password);
    if (!match) throw new UnauthorizedException('Mật khẩu cũ không đúng');

    const salt = await bcrypt.genSalt(10);
    userDoc.password = await bcrypt.hash(newPassword, salt);
    await userDoc.save();

    return { message: 'Đổi mật khẩu thành công' };
  }
}
