import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WatcherService } from './watcher.service';

@Controller('watcher')
@UseGuards(JwtAuthGuard)
export class WatcherController {
  constructor(private readonly service: WatcherService) {}

  @Post('applications')
  apply(@Req() req: any, @Body() body: { parkingLotId: string }) {
    return this.service.apply(req.user?.sub ?? req.user?.id, body.parkingLotId);
  }

  @Get('applications')
  getApplications(@Req() req: any) {
    return this.service.getApplications(req.user?.sub ?? req.user?.id);
  }

  @Get('lots')
  getLots(@Req() req: any) {
    return this.service.getLots(req.user?.sub ?? req.user?.id);
  }

  @Get('enforcement-cases')
  getEnforcementCases(@Req() req: any) {
    return this.service.getEnforcementCases(req.user?.sub ?? req.user?.id);
  }

  @Post('enforcement-cases/:id/register-proxy')
  registerProxy(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: { vehiclePlateNumber: string; contactPhone?: string; note?: string; vehiclePlatePhotoUrl?: string },
  ) {
    return this.service.registerProxy(req.user?.sub ?? req.user?.id, id, body);
  }

  @Get('registration-proxy-logs')
  getRegistrationProxyLogs(@Req() req: any) {
    return this.service.getRegistrationProxyLogs(req.user?.sub ?? req.user?.id);
  }
}
