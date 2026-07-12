import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { BillingSummaryService } from './billing-summary.service';

@Controller('billing/summary')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BillingSummaryController {
  constructor(private readonly billingSummaryService: BillingSummaryService) {}

  @Get()
  @RequirePermission('billing.summary.read')
  getSummary() {
    return this.billingSummaryService.getSummary();
  }
}