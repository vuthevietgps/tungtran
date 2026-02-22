import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectModel('User') private userModel: Model<any>,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret || secret === 'dev_secret') {
      throw new Error('JWT_SECRET must be set to a secure value in environment variables');
    }
    
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request) => {
          // Extract JWT from httpOnly cookie instead of Authorization header
          return request?.cookies?.access_token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    // Check user still exists, not locked, and get CURRENT role/email/fullName from DB
    const user = await this.userModel
      .findById(payload.sub)
      .select('status role email fullName')
      .lean() as any;
    if (!user) throw new UnauthorizedException('Tài khoản không tồn tại');
    if (user.status === 'LOCKED') throw new UnauthorizedException('Tài khoản đã bị khóa');

    return {
      sub: payload.sub,
      _id: payload.sub,
      userId: payload.sub,   // backward-compatible alias for legacy services
      email: user.email,       // from DB — always current
      role: user.role,         // from DB — always current
      fullName: user.fullName, // from DB — always current
    };
  }
}
