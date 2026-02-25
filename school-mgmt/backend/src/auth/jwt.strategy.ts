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
          return request?.cookies?.access_token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    const user = await this.userModel
      .findById(payload.sub)
      .select('status role email fullName userCode')
      .lean() as any;

    if (!user) throw new UnauthorizedException('Tai khoan khong ton tai');
    if (user.status === 'LOCKED') throw new UnauthorizedException('Tai khoan da bi khoa');

    return {
      sub: payload.sub,
      _id: payload.sub,
      userId: payload.sub,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      userCode: user.userCode,
    };
  }
}
