import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions';

import { SettlementService } from './settlement.service';
import { CloseSettlementDto } from './dto/close-settlement.dto';

@Controller(['settlement', 'billing/settlement'])
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SettlementController {
  constructor(private readonly settlementService: SettlementService) {}

  @Get()
  @RequirePermission(PERMISSIONS.SETTLEMENT_READ)
  listSettlements(
    @Query('parkingLotId') parkingLotId?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.settlementService.listSettlements({
      parkingLotId,
      year,
      month,
    });
  }

  @Get('parking-lots')
  @RequirePermission(PERMISSIONS.SETTLEMENT_READ)
  listSettlementParkingLots() {
    return this.settlementService.listSettlementParkingLots();
  }

  @Get('preview')
  @RequirePermission(PERMISSIONS.SETTLEMENT_READ)
  preview(
    @Query('parkingLotId') parkingLotId: string,
    @Query('businessDate') businessDate: string,
  ) {
    return this.settlementService.previewDailySettlement(
      parkingLotId,
      businessDate,
    );
  }

  @Post('close')
  @RequirePermission(PERMISSIONS.SETTLEMENT_MANAGE)
  close(@Body() dto: CloseSettlementDto, @Req() req: any) {
    return this.settlementService.closeDailySettlement(
      dto.parkingLotId,
      dto.businessDate,
      req.user?.id ?? req.user?.userId ?? req.user?.sub ?? null,
    );
  }
}
