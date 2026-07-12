import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MobileAuthService } from './mobile-auth.service';

@Controller()
export class MobileAuthController {
  constructor(private readonly mobileAuthService: MobileAuthService) {}

  // Legacy aliases
  @Post('mobile/auth/signup')
  async signup(@Body() body: any) {
    return this.mobileAuthService.memberSignup(body);
  }

  @Post('mobile/auth/login')
  async login(@Body() body: any) {
    return this.mobileAuthService.memberLogin(body);
  }

  // Member auth
  @Post('mobile/member/signup')
  async memberSignup(@Body() body: any) {
    return this.mobileAuthService.memberSignup(body);
  }

  @Post('mobile/member/login')
  async memberLogin(@Body() body: any) {
    return this.mobileAuthService.memberLogin(body);
  }

  // Visitor auth
  @Post('mobile/visitor/login')
  async visitorLogin(@Body() body: any) {
    return this.mobileAuthService.visitorLogin(body);
  }

  @Get('mobile/member/me')
  @UseGuards(JwtAuthGuard)
  async memberMe(@Req() req: any) {
    return this.mobileAuthService.memberMe(req.user);
  }

  @Get('mobile/member/vehicles')
  @UseGuards(JwtAuthGuard)
  async memberVehicles(@Req() req: any) {
    return this.mobileAuthService.memberVehicles(req.user);
  }
}
