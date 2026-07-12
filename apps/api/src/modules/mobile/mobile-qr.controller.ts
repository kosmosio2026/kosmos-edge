import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MobileQrService } from './mobile-qr.service';

@Controller('mobile/qr')
export class MobileQrController {
  constructor(private readonly service: MobileQrService) {}

  @Get(':qrToken')
  getQrParkingLot(@Param('qrToken') qrToken: string) {
    return this.service.getQrParkingLot(qrToken);
  }

  @Post(':qrToken/register-member')
  @UseGuards(JwtAuthGuard)
  registerMember(@Param('qrToken') qrToken: string, @Req() req: any, @Body() body: { parkingSpaceId: string }) {
    return this.service.registerMember(qrToken, req.user?.sub ?? req.user?.id, body);
  }

  @Post(':qrToken/register-visitor')
  registerVisitor(
    @Param('qrToken') qrToken: string,
    @Body() body: { parkingSpaceId: string; phone: string; vehiclePlateNumber: string; verificationToken?: string },
  ) {
    return this.service.registerVisitor(qrToken, body);
  }
}
