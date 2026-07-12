import {
  Body,
  Delete,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions';
import { AuthUser } from '../../common/types/auth-user.type';

import { ApprovalService } from './approval.service';
import { CreateManagerApprovalRequestDto } from './dto/create-manager-approval-request.dto';
import { CreateOperatorApprovalRequestDto } from './dto/create-operator-approval-request.dto';
import { CreateParkingLotApprovalRequestDto } from './dto/create-parking-lot-approval-request.dto';
import { CreateOperatorSectionApprovalRequestDto } from './dto/create-operator-section-approval-request.dto';
import { ReviewApprovalRequestDto } from './dto/review-approval-request.dto';

type ManagerLotRequestBody = {
  parkingLotId?: string;
  requestedParkingLotId?: string;
  note?: string;
};

type OperatorSectionRequestBody = {
  parkingLotId?: string;
  sectionId?: string;
  requestedParkingLotId?: string;
  requestedSectionId?: string;
  note?: string;
};

@Controller(['approval', 'approvals'])
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  /*
   account registration approvals
  */

  @UseGuards(JwtAuthGuard)
  @Post('manager-request')
  createManagerRequest(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateManagerApprovalRequestDto,
  ) {
    return this.approvalService.createManagerRequest(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('operator-request')
  createOperatorRequest(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOperatorApprovalRequestDto,
  ) {
    return this.approvalService.createOperatorRequest(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(PERMISSIONS.USER_MANAGE)
  @Get('admin/pending-managers')
  listPendingManagers() {
    return this.approvalService.listPendingManagersForAdmin();
  }

  @UseGuards(JwtAuthGuard)
  @Get('manager/pending-operators')
  listPendingOperators(@CurrentUser() user: AuthUser) {
    return this.approvalService.listPendingForManager(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/pending-operators')
  listPendingOperatorsForAdminOrManager(
    @CurrentUser() user: AuthUser,
  ) {
    return this.approvalService.listPendingOperatorsForAdminOrManager(
      user.sub,
    );
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(PERMISSIONS.USER_MANAGE)
  @Post(':requestId/review')
  review(
    @CurrentUser() user: AuthUser,
    @Param('requestId') requestId: string,
    @Body() dto: ReviewApprovalRequestDto,
  ) {
    return this.approvalService.review(user.sub, requestId, dto);
  }

  /*
   legacy parking lot approval routes
  */

  @UseGuards(JwtAuthGuard)
  @Post('parking-lot-request')
  createParkingLotRequest(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateParkingLotApprovalRequestDto,
  ) {
    return this.approvalService.createParkingLotRequest(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(PERMISSIONS.USER_MANAGE)
  @Get('admin/pending-parking-lots')
  listPendingParkingLots() {
    return this.approvalService.listPendingParkingLotsForAdmin();
  }

  /*
   legacy operator section routes
  */

  @UseGuards(JwtAuthGuard)
  @Post('operator-section-request')
  createOperatorSectionRequest(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateOperatorSectionApprovalRequestDto,
  ) {
    return this.approvalService.createOperatorSectionRequest(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('operator-section-requests/pending')
  listPendingOperatorSectionRequests(
    @CurrentUser() user: AuthUser,
  ) {
    return this.approvalService.listPendingOperatorSectionRequests(user.sub);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(PERMISSIONS.USER_MANAGE)
  @Get('admin/pending-operator-sections')
  listPendingOperatorSectionsForAdmin() {
    return this.approvalService.listPendingOperatorSectionRequestsForAdmin();
  }

  @UseGuards(JwtAuthGuard)
  @Get('manager/pending-operator-sections')
  listPendingOperatorSectionsForManager(@CurrentUser() user: AuthUser) {
    return this.approvalService.listPendingOperatorSectionRequests(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('operator/section-requests/my')
  listMyOperatorSectionRequests(@CurrentUser() user: AuthUser) {
    return this.approvalService.listMyOperatorSectionRequests(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('operator-section-requests/:requestId')
  withdrawOperatorSectionRequest(
    @CurrentUser() user: AuthUser,
    @Param('requestId') requestId: string,
  ) {
    return this.approvalService.withdrawOperatorSectionRequest(user.sub, requestId);
  }


  /*
   Web Batch 28C aliases
   Frontend calls these routes.
  */

  @UseGuards(JwtAuthGuard)
  @Post('manager-lots')
  createManagerLotAccessRequest(
    @CurrentUser() user: AuthUser,
    @Body() body: ManagerLotRequestBody,
  ) {
    return this.approvalService.createManagerLotAccessRequest(user.sub, {
      parkingLotId: body.parkingLotId ?? body.requestedParkingLotId,
      note: body.note,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('operator-sections')
  createOperatorSectionAccessRequest(
    @CurrentUser() user: AuthUser,
    @Body() body: OperatorSectionRequestBody,
  ) {
    return this.approvalService.createOperatorSectionAccessRequest(user.sub, {
      parkingLotId: body.parkingLotId ?? body.requestedParkingLotId,
      sectionId: body.sectionId ?? body.requestedSectionId,
      note: body.note,
    });
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(PERMISSIONS.USER_MANAGE)
  @Post('manager-lots/:requestId/review')
  reviewManagerLotAccessRequest(
    @CurrentUser() user: AuthUser,
    @Param('requestId') requestId: string,
    @Body() dto: ReviewApprovalRequestDto,
  ) {
    return this.approvalService.review(user.sub, requestId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('operator-sections/:requestId/review')
  reviewOperatorSectionAccessRequest(
    @CurrentUser() user: AuthUser,
    @Param('requestId') requestId: string,
    @Body() dto: ReviewApprovalRequestDto,
  ) {
    return this.approvalService.review(user.sub, requestId, dto);
  }
}