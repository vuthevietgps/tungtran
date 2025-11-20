import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService, private jwtService: JwtService) {}

  async validateUser(email: string, pass: string) {
    const user = await this.usersService.findByEmail(email.toLowerCase());
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!user.password) throw new UnauthorizedException('Invalid credentials');
    const match = await bcrypt.compare(pass, user.password);
    if (!match) throw new UnauthorizedException('Invalid credentials');
    const { password, ...result } = user.toObject();
    return result;
  }

  async login(user: any) {
    const payload = { sub: user._id, email: user.email, role: user.role, fullName: user.fullName };
    return {
      access_token: await this.jwtService.signAsync(payload),
      user: payload,
    };
  }
}
