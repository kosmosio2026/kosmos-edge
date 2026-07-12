import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

type VerifyEmailDto = {
  token: string;
};

type ResendVerificationDto = {
  email: string;
};

type ForgotPasswordDto = {
  email: string;
};

type ResetPasswordDto = {
  token: string;
  password: string;
};

type RefreshDto = {
  refreshToken: string;
};

type LogoutDto = {
  refreshToken: string;
};

type UpdateMyProfileDto = {
  phone?: string | null;
  emergencyContact?: string | null;
  currentPassword: string;
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  @Post('register')
  register(
    @Body() dto: RegisterDto,
  ) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(
    @Body() dto: LoginDto,
    @Req() req: any,
  ) {
    return this.authService.login(
      dto.email,
      dto.password,
      {
        ip: req.ip,
        userAgent: req.headers?.['user-agent'],
        deviceId: req.headers?.['x-device-id'],
      },
    );
  }

  @Post('refresh')
  refresh(
    @Body() dto: RefreshDto,
  ) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  logout(
    @Body() dto: LogoutDto,
  ) {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('verify-email')
  verifyEmail(
    @Body() dto: VerifyEmailDto,
  ) {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('resend-verification')
  resendVerification(
    @Body() dto: ResendVerificationDto,
  ) {
    return this.authService.resendVerification(dto.email);
  }

  @Post('forgot-password')
  forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  resetPassword(
    @Body() dto: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(
    @CurrentUser() user: any,
  ) {
    return this.authService.me(user.sub ?? user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/profile')
  updateMyProfile(
    @CurrentUser() user: any,
    @Body() dto: UpdateMyProfileDto,
  ) {
    return this.authService.updateMyProfile(user.sub ?? user.id, dto);
  }
}