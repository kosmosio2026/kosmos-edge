import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions';

import { BillingService } from './billing.service';

@Controller('billing')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}


  @Get()
  @RequirePermission(PERMISSIONS.BILLING_READ)
  listBillingRecords() {
    return this.billingService.listBillingRecords();
  }

  @Get('summary')
  @RequirePermission(PERMISSIONS.BILLING_SUMMARY_READ)
  getSummary() {
    return this.billingService.getSummary();
  }

  @Get('outstanding')
  @RequirePermission(PERMISSIONS.OUTSTANDING_READ)
  getOutstanding() {
    return this.billingService.getOutstandingInvoices();
  }

  @Get('invoice/by-session/:sessionId')
  @RequirePermission(PERMISSIONS.BILLING_READ)
  getInvoiceBySession(@Param('sessionId') sessionId: string) {
    return this.billingService.getInvoiceBySession(sessionId);
  }

  @Post('pay/:id')
  @RequirePermission(PERMISSIONS.BILLING_MANAGE)
  pay(@Param('id') id: string) {
    return this.billingService.payInvoice(id);
  }

  @Post('force-close/:id')
  @RequirePermission(PERMISSIONS.BILLING_MANAGE)
  forceClose(@Param('id') id: string) {
    return this.billingService.forceCloseInvoice(id);
  }

  @Post('receipt/:id')
  @RequirePermission(PERMISSIONS.BILLING_READ)
  issueReceipt(@Param('id') id: string) {
    return this.billingService.issueReceipt(id);
  }
}