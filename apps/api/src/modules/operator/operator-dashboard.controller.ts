import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { OperatorDashboardService } from './operator-dashboard.service';

@Controller('operator/dashboard')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OperatorDashboardController {
  constructor(
    private readonly operatorDashboardService: OperatorDashboardService,
  ) {}

  @Get('summary')
  @RequirePermission('operator.dashboard.read')
  getSummary(@Query('parkingLotId') parkingLotId?: string) {
    return this.operatorDashboardService.getSummary(parkingLotId);
  }

  @Get('live-spaces')
  @RequirePermission('operator.dashboard.read')
  getLiveSpaces(@Query('parkingLotId') parkingLotId?: string) {
    return this.operatorDashboardService.getLiveSpaces(parkingLotId);
  }
}