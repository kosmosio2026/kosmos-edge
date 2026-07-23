import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantsService } from './tenants.service';
import { TenantCouponsService } from './tenant-coupons.service';
import { CreateTenantCouponProductDto } from './dto/create-tenant-coupon-product.dto';
import { UpdateTenantCouponProductDto } from './dto/update-tenant-coupon-product.dto';
import { CreateTenantCouponPurchaseDto } from './dto/create-tenant-coupon-purchase.dto';
import { ConfirmTenantCouponPaymentDto } from './dto/confirm-tenant-coupon-payment.dto';
import { AssignTenantCouponDto } from './dto/assign-tenant-coupon.dto';

@Controller('tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly tenantCouponsService: TenantCouponsService,
  ) {}

  @Get()
  findAll(@Req() request: any) {
    return this.tenantsService.findAll(request.user);
  }


  @Get('coupon-products')
  listCouponProducts(
    @Query('parkingLotId') parkingLotId: string | undefined,
    @Req() request: any,
  ) {
    return this.tenantCouponsService.listProducts(request.user, parkingLotId);
  }

  @Post('coupon-products')
  createCouponProduct(
    @Body() dto: CreateTenantCouponProductDto,
    @Req() request: any,
  ) {
    return this.tenantCouponsService.createProduct(request.user, dto);
  }

  @Patch('coupon-products/:productId')
  updateCouponProduct(
    @Param('productId') productId: string,
    @Body() dto: UpdateTenantCouponProductDto,
    @Req() request: any,
  ) {
    return this.tenantCouponsService.updateProduct(request.user, productId, dto);
  }

  @Post(':tenantId/coupon-purchases')
  createCouponPurchase(
    @Param('tenantId') tenantId: string,
    @Body() dto: CreateTenantCouponPurchaseDto,
    @Req() request: any,
  ) {
    return this.tenantCouponsService.createPurchase(request.user, tenantId, dto);
  }

  @Get(':tenantId/coupon-purchases')
  listCouponPurchases(
    @Param('tenantId') tenantId: string,
    @Req() request: any,
  ) {
    return this.tenantCouponsService.listPurchases(request.user, tenantId);
  }

  @Post(':tenantId/coupon-purchases/:purchaseId/confirm-payment')
  confirmCouponPayment(
    @Param('tenantId') tenantId: string,
    @Param('purchaseId') purchaseId: string,
    @Body() dto: ConfirmTenantCouponPaymentDto,
    @Req() request: any,
  ) {
    return this.tenantCouponsService.confirmPaymentAndIssue(
      request.user,
      tenantId,
      purchaseId,
      dto,
    );
  }

  @Get(':tenantId/coupon-inventory')
  getCouponInventory(
    @Param('tenantId') tenantId: string,
    @Req() request: any,
  ) {
    return this.tenantCouponsService.getInventory(request.user, tenantId);
  }

  @Get(':tenantId/coupon-members/search')
  searchCouponMembers(
    @Param('tenantId') tenantId: string,
    @Query('query') query: string,
    @Req() request: any,
  ) {
    return this.tenantCouponsService.searchMembers(request.user, tenantId, query);
  }

  @Post(':tenantId/coupons/assign')
  assignCoupon(
    @Param('tenantId') tenantId: string,
    @Body() dto: AssignTenantCouponDto,
    @Req() request: any,
  ) {
    return this.tenantCouponsService.assignCoupon(request.user, tenantId, dto);
  }

  @Get(':tenantId/coupon-assignments')
  listCouponAssignments(
    @Param('tenantId') tenantId: string,
    @Req() request: any,
  ) {
    return this.tenantCouponsService.listAssignments(request.user, tenantId);
  }

  @Post(':tenantId/visits/:parkingSessionId/confirm')
  confirmVisit(
    @Param('tenantId') tenantId: string,
    @Param('parkingSessionId') parkingSessionId: string,
    @Body() body: { note?: string },
    @Req() request: any,
  ) {
    return this.tenantsService.confirmVisit(tenantId, parkingSessionId, body, request.user);
  }

  @Get(':tenantId/parking-lots')
  findParkingLots(@Param('tenantId') tenantId: string, @Req() request: any) {
    return this.tenantsService.findParkingLots(tenantId, request.user);
  }

  @Get(':tenantId/users')
  findUsers(@Param('tenantId') tenantId: string, @Req() request: any) {
    return this.tenantsService.findUsers(tenantId, request.user);
  }



  @Get('billing/statements')
  findBillingStatements(
    @Query('billingMonth') billingMonth: string | undefined,
    @Query('status') status: string | undefined,
    @Query('tenantId') tenantId: string | undefined,
    @Query('parkingLotId') parkingLotId: string | undefined,
    @Req() request: any,
  ) {
    return this.tenantsService.findBillingStatements(request.user, {
      billingMonth,
      status,
      tenantId,
      parkingLotId,
    });
  }

  @Get('billing/charges')
  findBillingCharges(
    @Query('billingMonth') billingMonth: string | undefined,
    @Query('status') status: string | undefined,
    @Query('tenantId') tenantId: string | undefined,
    @Query('parkingLotId') parkingLotId: string | undefined,
    @Req() request: any,
  ) {
    return this.tenantsService.findBillingCharges(request.user, {
      billingMonth,
      status,
      tenantId,
      parkingLotId,
    });
  }

  @Get(':tenantId/statements')
  findTenantStatements(
    @Param('tenantId') tenantId: string,
    @Query('billingMonth') billingMonth: string | undefined,
    @Query('status') status: string | undefined,
    @Req() request: any,
  ) {
    return this.tenantsService.findTenantStatements(tenantId, request.user, {
      billingMonth,
      status,
    });
  }

  @Get(':tenantId/charges')
  findTenantCharges(
    @Param('tenantId') tenantId: string,
    @Query('billingMonth') billingMonth: string | undefined,
    @Query('status') status: string | undefined,
    @Req() request: any,
  ) {
    return this.tenantsService.findTenantCharges(tenantId, request.user, {
      billingMonth,
      status,
    });
  }

  @Post(':tenantId/statements/:statementId/close')
  closeTenantStatement(
    @Param('tenantId') tenantId: string,
    @Param('statementId') statementId: string,
    @Body() body: { memo?: string | null },
    @Req() request: any,
  ) {
    return this.tenantsService.closeTenantStatement(
      tenantId,
      statementId,
      request.user,
      body,
    );
  }

  @Get(':tenantId')
  findOne(@Param('tenantId') tenantId: string, @Req() request: any) {
    return this.tenantsService.findOne(tenantId, request.user);
  }
}
