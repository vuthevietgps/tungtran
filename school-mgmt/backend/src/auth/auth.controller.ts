import { Controller, Post, Body, UseGuards, Res, Req } from '@nestjs/common';
import { Response, Request } from 'express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { LocalAuthGuard } from './local-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthService } from './auth.service';
import { AuthenticatedRequest } from '../common/interfaces/authenticated-request.interface';
import { UserDocument } from '../users/schemas/user.schema';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(ThrottlerGuard, LocalAuthGuard)
  @Post('login')
  async login(@Req() req: Request & { user: UserDocument }, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(req.user);

    // Set httpOnly cookie (not accessible from JavaScript - XSS protection)
    res.cookie('access_token', result.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/', // Ensure cookie is sent with all API requests
    });

    // Return user info only (no token in response body)
    return {
      user: {
        _id: req.user._id,
        email: req.user.email,
        role: req.user.role,
        fullName: req.user.fullName,
      }
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
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
