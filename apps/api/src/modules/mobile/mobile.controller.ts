import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions';
import { AuthUser } from '../../common/types/auth-user.type';

import { MobileMapService } from './mobile-map.service';
import { MobileParkingService } from './mobile-parking.service';
import { MobileAuthService } from './mobile-auth.service';
import { VisitorVerificationService } from './visitor-verification.service';
import { MobileVehicleService } from './mobile-vehicle.service';
import { MobileStatusService } from './mobile-status.service';
import { MobileNotificationService } from './mobile-notification.service';
import { MobileHomeService } from './mobile-home.service';
import { MobileCouponService } from './mobile-coupon.service';

import { RegisterOccupiedSpaceDto } from './dto/register-occupied-space.dto';
import { VisitorLoginDto } from './dto/visitor-login.dto';
import { VisitorRegisterDto } from './dto/visitor-register.dto';
import { VisitorHistoryQueryDto } from './dto/visitor-history-query.dto';
import { RequestPhoneVerificationDto } from './dto/request-phone-verification.dto';
import { VerifyPhoneDto } from './dto/verify-phone.dto';
import { ResetVisitorPinDto } from './dto/reset-visitor-pin.dto';
import { CreateMyVehicleDto } from './dto/create-my-vehicle.dto';
import { UpdateMyVehicleDto } from './dto/update-my-vehicle.dto';
import { UpdateVisitorVehicleDto } from './dto/update-visitor-vehicle.dto';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { MobileMapQueryDto } from './dto/mobile-map-query.dto';
import { MemberSignupDto } from './dto/member-signup.dto';
import { MemberLoginDto } from './dto/member-login.dto';
import {
  ConfirmMemberPasswordResetDto,
  RequestMemberPasswordResetDto,
} from './dto/member-password-reset.dto';
import {
  ReleaseTenantCouponDto,
  ReserveTenantCouponDto,
} from './dto/reserve-tenant-coupon.dto';

@Controller('mobile')
export class MobileController {
  constructor(
    private readonly mobileMapService: MobileMapService,
    private readonly mobileParkingService: MobileParkingService,
    private readonly mobileAuthService: MobileAuthService,
    private readonly visitorVerificationService: VisitorVerificationService,
    private readonly mobileVehicleService: MobileVehicleService,
    private readonly mobileStatusService: MobileStatusService,
    private readonly mobileNotificationService: MobileNotificationService,
    private readonly mobileHomeService: MobileHomeService,
    private readonly mobileCouponService: MobileCouponService,
  ) {}

  @Get('map/spaces')
  listMapSpaces(@Query('parkingLotId') parkingLotId?: string) {
    return this.mobileMapService.listMapSpaces(parkingLotId);
  }

  @Get('map/registerable-occupied-spaces')
  listRegisterableOccupiedSpaces(@Query('parkingLotId') parkingLotId?: string) {
    return this.mobileMapService.listRegisterableOccupiedSpaces(parkingLotId);
  }

  @Post('member/signup')
  registerMember(@Body() dto: MemberSignupDto) {
    return this.mobileAuthService.registerMember(dto);
  }

  @Post('member/login')
  loginMember(@Body() dto: MemberLoginDto) {
    return this.mobileAuthService.loginMember(dto);
  }


  @Post('member/password-reset/request')
  requestMemberPasswordReset(@Body() dto: RequestMemberPasswordResetDto) {
    return this.mobileAuthService.requestMemberPasswordReset(dto);
  }

  @Post('member/password-reset/confirm')
  confirmMemberPasswordReset(@Body() dto: ConfirmMemberPasswordResetDto) {
    return this.mobileAuthService.confirmMemberPasswordReset(dto);
  }

  @Post('visitor/request-phone-verification')
  requestPhoneVerification(@Body() dto: RequestPhoneVerificationDto) {
    return this.visitorVerificationService.requestPhoneVerification(dto.phone);
  }

  @Post('visitor/verify-phone')
  verifyPhone(@Body() dto: VerifyPhoneDto) {
    return this.visitorVerificationService.verifyPhone(dto.phone, dto.code);
  }

  @Post('visitor/register')
  registerVisitor(@Body() dto: VisitorRegisterDto) {
    return this.mobileAuthService.registerVisitor(dto);
  }

  @Post('visitor/login')
  loginVisitor(@Body() dto: VisitorLoginDto) {
    return this.mobileAuthService.loginVisitor(dto);
  }

  @Post('visitor/history')
  visitorHistory(@Body() dto: VisitorHistoryQueryDto) {
    return this.mobileAuthService.getVisitorHistory(dto.phone, dto.pin);
  }

  @Post('visitor/reset-pin')
  async resetVisitorPin(@Body() dto: ResetVisitorPinDto) {
    const code =
      dto.code || dto.verificationCode || dto.phoneVerificationCode || '';

    await this.visitorVerificationService.verifyPhone(dto.phone, code);

    return this.mobileAuthService.resetVisitorPin(
      dto.phone,
      dto.pin || dto.pinCode || '',
    );
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(PERMISSIONS.OPERATOR_DASHBOARD_READ)
  @Get('map/optimized')
  getOptimizedMap(
    @CurrentUser() user: AuthUser,
    @Query() query: MobileMapQueryDto,
  ) {
    return this.mobileMapService.getOptimizedMap(user.sub, query);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(PERMISSIONS.OPERATOR_DASHBOARD_READ)
  @Get('operator/map/optimized')
  getOperatorOptimizedMap(
    @CurrentUser() user: AuthUser,
    @Query() query: MobileMapQueryDto,
  ) {
    return this.mobileMapService.getOptimizedMap(user.sub, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('parking/current')
  getCurrentParking(
    @CurrentUser() user: AuthUser,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.mobileParkingService.getCurrentParking(user, sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('parking/current/fee-preview')
  previewCurrentFee(
    @CurrentUser() user: AuthUser,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.mobileParkingService.previewCurrentFee(user, sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('parking/current/finalize-invoice')
  finalizeCurrentInvoice(
    @CurrentUser() user: AuthUser,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.mobileParkingService.finalizeCurrentInvoice(user, sessionId);
  }



  @UseGuards(JwtAuthGuard)
  @Get('payments')
  listPayments(@CurrentUser() user: AuthUser) {
    return this.mobileParkingService.listPayments(user);
  }


  @UseGuards(JwtAuthGuard)
  @Get('me/current-session')
  getMyCurrentSession(@CurrentUser() user: AuthUser) {
    return this.mobileParkingService.getMyCurrentSession(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/sessions')
  listMySessions(@CurrentUser() user: AuthUser) {
    return this.mobileParkingService.listMySessions(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/home')
  getHome(@CurrentUser() user: AuthUser) {
    return this.mobileHomeService.getHome(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/register-occupied-space')
  registerOccupiedSpace(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegisterOccupiedSpaceDto,
  ) {
    return this.mobileParkingService.registerOccupiedSpace(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/parking-status')
  getMyParkingStatus(@CurrentUser() user: AuthUser) {
    return this.mobileStatusService.getMyParkingStatus(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/push-token')
  registerPushToken(
    @CurrentUser() user: AuthUser,
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.mobileNotificationService.registerPushToken(
      user.sub,
      dto.token,
      dto.platform,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/vehicles')
  listMyVehicles(@CurrentUser() user: AuthUser) {
    return this.mobileVehicleService.listMyVehicles(user.sub);
  }


  @UseGuards(JwtAuthGuard)
  @Post('me/coupons/:couponId/reserve')
  reserveMyCoupon(
    @CurrentUser() user: AuthUser,
    @Param('couponId') couponId: string,
    @Body() dto: ReserveTenantCouponDto,
  ) {
    return this.mobileCouponService.reserveMyCoupon(
      user.sub,
      couponId,
      dto.sessionId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/coupons/:couponId/release')
  releaseMyCoupon(
    @CurrentUser() user: AuthUser,
    @Param('couponId') couponId: string,
    @Body() dto: ReleaseTenantCouponDto,
  ) {
    return this.mobileCouponService.releaseMyCoupon(
      user.sub,
      couponId,
      dto.sessionId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/coupons')
  listMyCoupons(
    @CurrentUser() user: AuthUser,
    @Query('parkingLotId') parkingLotId?: string,
  ) {
    return this.mobileCouponService.listMyCoupons(user.sub, parkingLotId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/vehicles')
  createMyVehicle(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateMyVehicleDto,
  ) {
    return this.mobileVehicleService.createMyVehicle(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/vehicles/:userVehicleId')
  updateMyVehicle(
    @CurrentUser() user: AuthUser,
    @Param('userVehicleId') userVehicleId: string,
    @Body() dto: UpdateMyVehicleDto,
  ) {
    return this.mobileVehicleService.updateMyVehicle(
      user.sub,
      userVehicleId,
      dto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/vehicles/:userVehicleId')
  deleteMyVehicle(
    @CurrentUser() user: AuthUser,
    @Param('userVehicleId') userVehicleId: string,
  ) {
    return this.mobileVehicleService.deleteMyVehicle(user.sub, userVehicleId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/visitor-vehicle')
  updateVisitorVehicle(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateVisitorVehicleDto,
  ) {
    return this.mobileVehicleService.updateVisitorVehicle(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/notifications')
  listMyNotifications(@CurrentUser() user: AuthUser) {
    return this.mobileNotificationService.listMyNotifications(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/notifications/:notificationId/read')
  markNotificationRead(
    @CurrentUser() user: AuthUser,
    @Param('notificationId') notificationId: string,
  ) {
    return this.mobileNotificationService.markAsRead(
      user.sub,
      notificationId,
    );
  }
}