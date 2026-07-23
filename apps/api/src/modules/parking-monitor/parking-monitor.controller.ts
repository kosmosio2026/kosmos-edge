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
  async getLiveSpaceStates(@CurrentUser() user: AuthUser) {
    try {
      return await this.parkingMonitorService.getLiveSpaceStates(user);
    } catch (error) {
      const errorDetails =
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
              cause: error.cause,
            }
          : error;

      console.error(
        '[ParkingMonitorController] spaces/live failed',
        {
          userId: user?.sub ?? null,
          roles: (user as any)?.roles ?? null,
          error: errorDetails,
        },
      );

      throw error;
    }
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
