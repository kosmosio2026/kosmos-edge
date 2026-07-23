import {
  Headers, Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantAppService } from './tenant-app.service';
import { CreateTenantCouponPurchaseDto } from '../tenants/dto/create-tenant-coupon-purchase.dto';
import { AssignTenantCouponDto } from '../tenants/dto/assign-tenant-coupon.dto';

@Controller('tenant-app')
export class TenantAppController {
  constructor(private readonly tenantAppService: TenantAppService) {}

  @Post('auth/login')
  login(
    @Body()
    body: {
      businessNumber?: string;
      pin?: string;
    },
  ) {
    return this.tenantAppService.login(body);
  }

  @Get('me')
  me(@Headers('authorization') authorization?: string) {
    return this.tenantAppService.me(authorization);
  }

  @Post('auth/change-pin')
  changePin(
    @Headers('authorization') authorization: string | undefined,
    @Body()
    body: {
      currentPin?: string;
      newPin?: string;
    },
  ) {
    return this.tenantAppService.changePin(authorization, body);
  }

  @Get('visits/search')
  searchVisits(
    @Headers('authorization') authorization: string | undefined,
    @Query('q') query?: string,
  ) {
    return this.tenantAppService.searchVisits(authorization, query);
  }

  @Post('visits/:parkingSessionId/confirm')
  confirmVisit(
    @Headers('authorization') authorization: string | undefined,
    @Param('parkingSessionId') parkingSessionId: string,
    @Body()
    body: {
      note?: string;
    },
  ) {
    return this.tenantAppService.confirmVisitFromApp(authorization, parkingSessionId, body);
  }

  @Get('visits/history')
  visitHistory(
    @Headers('authorization') authorization: string | undefined,
    @Query('date') date?: string,
    @Query('q') q?: string,
  ) {
    return this.tenantAppService.visitHistory(authorization, { date, q });
  }

  @Get('coupon-products')
  listCouponProducts(
    @Headers('authorization') authorization?: string,
  ) {
    return this.tenantAppService.listCouponProducts(authorization);
  }

  @Get('coupon-purchases')
  listCouponPurchases(
    @Headers('authorization') authorization?: string,
  ) {
    return this.tenantAppService.listCouponPurchases(authorization);
  }

  @Post('coupon-purchases')
  createCouponPurchase(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: CreateTenantCouponPurchaseDto,
  ) {
    return this.tenantAppService.createCouponPurchase(authorization, dto);
  }

  @Get('coupon-inventory')
  getCouponInventory(
    @Headers('authorization') authorization?: string,
  ) {
    return this.tenantAppService.getCouponInventory(authorization);
  }

  @Get('coupon-members/search')
  searchCouponMembers(
    @Headers('authorization') authorization: string | undefined,
    @Query('q') query?: string,
  ) {
    return this.tenantAppService.searchCouponMembers(authorization, query);
  }

  @Post('coupons/assign')
  assignCoupon(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: AssignTenantCouponDto,
  ) {
    return this.tenantAppService.assignCoupon(authorization, dto);
  }

  @Get('coupon-assignments')
  listCouponAssignments(
    @Headers('authorization') authorization?: string,
  ) {
    return this.tenantAppService.listCouponAssignments(authorization);
  }

  @Get('parking-lots/by-code/:code')
  findParkingLotByCode(@Param('code') code: string) {
    return this.tenantAppService.findParkingLotByCode(code);
  }

  @Post('applications')
  createApplication(
    @Body()
    body: {
      parkingLotId?: string;
      parkingLotCode?: string;
      companyName?: string;
      businessNumber?: string;
      pin?: string;
      representative?: string;
      contact?: string;
      billingEmail?: string;
      applicantName?: string;
      applicantPhone?: string;
      applicantEmail?: string;
      memo?: string;
    },
  ) {
    return this.tenantAppService.createApplication(body);
  }

  @Get('approvals')
  @UseGuards(JwtAuthGuard)
  async findApprovals(
    @Query('status') status: string | undefined,
    @Query('parkingLotId') parkingLotId: string | undefined,
    @Req() request: any,
  ) {
    try {
      return await this.tenantAppService.findApprovals(request.user, {
        status,
        parkingLotId,
      });
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
        '[TenantAppController] approvals failed',
        {
          userId: request.user?.sub ?? null,
          roles: request.user?.roles ?? null,
          status: status ?? null,
          parkingLotId: parkingLotId ?? null,
          error: errorDetails,
        },
      );

      throw error;
    }
  }

  @Post('approvals/:id/approve')
  @UseGuards(JwtAuthGuard)
  approveApplication(@Param('id') id: string, @Req() request: any) {
    return this.tenantAppService.approveApplication(id, request.user);
  }

  @Post('approvals/:id/reject')
  @UseGuards(JwtAuthGuard)
  rejectApplication(
    @Param('id') id: string,
    @Body() body: { rejectReason?: string },
    @Req() request: any,
  ) {
    return this.tenantAppService.rejectApplication(id, body, request.user);
  }
}
