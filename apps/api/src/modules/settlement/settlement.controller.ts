import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

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
  listSettlements() {
    return this.settlementService.listSettlements();
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
  close(@Body() dto: CloseSettlementDto) {
    return this.settlementService.closeDailySettlement(
      dto.parkingLotId,
      dto.businessDate,
    );
  }
}
