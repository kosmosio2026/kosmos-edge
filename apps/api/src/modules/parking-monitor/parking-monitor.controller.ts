import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { PERMISSIONS } from '../../common/rbac/permissions';
import { ParkingMonitorService } from './parking-monitor.service';
import type { AuthUser } from '../../common/types/auth-user.type';

@Controller('parking-monitor')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ParkingMonitorController {
  constructor(private readonly parkingMonitorService: ParkingMonitorService) {}

  @Post('scan-unregistered-overdue')
  @RequirePermission(PERMISSIONS.PARKING_SPACE_READ)
  scanUnregisteredOverdue() {
    return this.parkingMonitorService.markUnregisteredOverdueSessions();
  }

  @Get('spaces/live')
  @RequirePermission(PERMISSIONS.PARKING_SPACE_READ)
  getLiveSpaceStates(@CurrentUser() user: AuthUser) {
    return this.parkingMonitorService.getLiveSpaceStates(user);
  }

  @Get('lots/:parkingLotId/spaces/live')
  @RequirePermission(PERMISSIONS.PARKING_SPACE_READ)
  getLiveSpaceStatesByLot(
    @Param('parkingLotId') parkingLotId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.parkingMonitorService.getLiveSpaceStatesByLot(
      parkingLotId,
      user,
    );
  }
}
