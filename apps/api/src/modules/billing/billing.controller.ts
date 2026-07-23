import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions';

import { BillingService } from './billing.service';
import { BillingSummaryService } from './billing-summary.service';
import { ParkingDiscountProgramsService } from './parking-discount-programs.service';
import { CreateParkingDiscountProgramDto } from './dto/create-parking-discount-program.dto';
import { UpdateParkingDiscountProgramDto } from './dto/update-parking-discount-program.dto';

@Controller('billing')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BillingController {
  @Inject(BillingSummaryService)
  private readonly billingSummaryService!: BillingSummaryService;

  constructor(
    private readonly billingService: BillingService,
    private readonly parkingDiscountProgramsService: ParkingDiscountProgramsService,
  ) {}

  @Get('discount-eligibilities')
  @RequirePermission(PERMISSIONS.BILLING_DISCOUNT_READ)
  listDiscountEligibilities() {
    return this.parkingDiscountProgramsService.listEligibilityDefinitions();
  }

  @Get('discount-programs')
  @RequirePermission(PERMISSIONS.BILLING_DISCOUNT_READ)
  listDiscountPrograms(@Query('parkingLotId') parkingLotId?: string) {
    return this.parkingDiscountProgramsService.list(parkingLotId);
  }

  @Get('discount-programs/:id')
  @RequirePermission(PERMISSIONS.BILLING_DISCOUNT_READ)
  getDiscountProgram(@Param('id') id: string) {
    return this.parkingDiscountProgramsService.get(id);
  }

  @Post('discount-programs')
  @RequirePermission(PERMISSIONS.BILLING_DISCOUNT_MANAGE)
  createDiscountProgram(@Body() dto: CreateParkingDiscountProgramDto) {
    return this.parkingDiscountProgramsService.create(dto);
  }

  @Patch('discount-programs/:id')
  @RequirePermission(PERMISSIONS.BILLING_DISCOUNT_MANAGE)
  updateDiscountProgram(
    @Param('id') id: string,
    @Body() dto: UpdateParkingDiscountProgramDto,
  ) {
    return this.parkingDiscountProgramsService.update(id, dto);
  }

  @Delete('discount-programs/:id')
  @RequirePermission(PERMISSIONS.BILLING_DISCOUNT_MANAGE)
  removeDiscountProgram(@Param('id') id: string) {
    return this.parkingDiscountProgramsService.remove(id);
  }

  @Get()
  @RequirePermission(PERMISSIONS.BILLING_READ)
  listBillingRecords() {
    return this.billingService.listBillingRecords();
  }

  @Get('summary/options')
  @RequirePermission('billing.summary.read')
  getSummaryOptions(
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

  @Get('summary/filter-options')
  @RequirePermission('billing.summary.read')
  getSummaryFilterOptions(
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

  @Get('summary')
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
