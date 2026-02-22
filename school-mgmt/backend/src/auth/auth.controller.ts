import { Controller, Post, Body, UseGuards, Res, Req } from '@nestjs/common';
import { Response, Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { LocalAuthGuard } from './local-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from './auth.service';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { UserDocument } from '../users/schemas/user.schema';
import { ChangePasswordDto } from './dto/change-password.dto';
import { WorkSessionsService } from '../work-sessions/work-sessions.service';

const loginThrottleTtl = Number(process.env.AUTH_LOGIN_THROTTLE_TTL ?? 60000);
const loginThrottleLimit = Number(
  process.env.AUTH_LOGIN_THROTTLE_LIMIT ??
    (process.env.NODE_ENV === 'production' ? 5 : 20),
);

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private workSessionsService: WorkSessionsService,
  ) {}

  @Throttle({ default: { ttl: loginThrottleTtl, limit: loginThrottleLimit } })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(
    @Req() req: Request & { user: UserDocument },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(req.user);

    res.cookie('access_token', result.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return {
      user: {
        _id: req.user._id,
        email: req.user.email,
        role: req.user.role,
        fullName: req.user.fullName,
      },
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      await this.workSessionsService.recordLogout(req.user.sub);
    } catch (_err) {
      // Ignore attendance logging errors on logout.
    }

    res.clearCookie('access_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
    return { message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.sub, dto.oldPassword, dto.newPassword);
  }
}
