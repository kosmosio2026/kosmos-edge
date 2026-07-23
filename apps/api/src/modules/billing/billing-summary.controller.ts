import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { BillingSummaryService } from './billing-summary.service';

@Controller('billing/summary')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BillingSummaryController {
  constructor(private readonly billingSummaryService: BillingSummaryService) {}

  @Get('options')
  @RequirePermission('billing.summary.read')
  getOptions(
    @Req() req: any,
    @Query('region') region?: string,
    @Query('district') district?: string,
  ) {
    return this.billingSummaryService.getFilterOptions({
      user: req.user,
      region,
      district,
    });
  }

  @Get('filter-options')
  @RequirePermission('billing.summary.read')
  getFilterOptions(
    @Req() req: any,
    @Query('region') region?: string,
    @Query('district') district?: string,
  ) {
    return this.billingSummaryService.getFilterOptions({
      user: req.user,
      region,
      district,
    });
  }

  @Get()
  @RequirePermission('billing.summary.read')
  getSummary(
    @Req() req: any,
    @Query('region') region?: string,
    @Query('district') district?: string,
    @Query('parkingLotId') parkingLotId?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    return this.billingSummaryService.getSummary({
      user: req.user,
      region,
      district,
      parkingLotId,
      year,
      month,
    });
  }
}
