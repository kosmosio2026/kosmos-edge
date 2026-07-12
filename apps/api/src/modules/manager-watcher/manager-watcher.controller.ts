import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ManagerWatcherService } from './manager-watcher.service';

@Controller('manager/watcher-applications')
@UseGuards(JwtAuthGuard)
export class ManagerWatcherController {
  constructor(private readonly service: ManagerWatcherService) {}

  @Get()
  listApplications(@Req() req: any) {
    return this.service.listApplications(req.user?.sub ?? req.user?.id);
  }

  @Post(':id/approve')
  approve(@Req() req: any, @Param('id') id: string) {
    return this.service.approve(id, req.user?.sub ?? req.user?.id);
  }

  @Post(':id/reject')
  reject(@Req() req: any, @Param('id') id: string, @Body() body: { reason?: string }) {
    return this.service.reject(id, req.user?.sub ?? req.user?.id, body.reason);
  }
}

@Controller('admin/watcher-applications')
@UseGuards(JwtAuthGuard)
export class AdminWatcherController {
  constructor(private readonly service: ManagerWatcherService) {}

  @Get()
  listApplications(@Req() req: any) {
    return this.service.listApplications(req.user?.sub ?? req.user?.id);
  }

  @Post(':id/approve')
  approve(@Req() req: any, @Param('id') id: string) {
    return this.service.approve(id, req.user?.sub ?? req.user?.id);
  }

  @Post(':id/reject')
  reject(@Req() req: any, @Param('id') id: string, @Body() body: { reason?: string }) {
    return this.service.reject(id, req.user?.sub ?? req.user?.id, body.reason);
  }
}
