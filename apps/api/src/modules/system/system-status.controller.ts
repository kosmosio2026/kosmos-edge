import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types/auth-user.type';
import { SystemStatusService } from './system-status.service';

@Controller('system')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SystemStatusController {
  constructor(private readonly systemStatusService: SystemStatusService) {}

  @Get('status')
  getStatus(@CurrentUser() user: AuthUser) {
    if (!user.roles.includes('ADMIN')) {
      return {
        ok: false,
        message: 'Admin only',
      };
    }

    return this.systemStatusService.getSystemStatus();
  }

}