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
import { PERMISSIONS } from '../../common/rbac/permissions';

import { FeePoliciesService } from './fee-policies.service';
import { FeePolicyListQueryDto } from './queries/fee-policy-list-query.dto';
import { CreateFeePolicyDto } from './dto/create-fee-policy.dto';
import { UpdateFeePolicyDto } from './dto/update-fee-policy.dto';

@Controller('billing/fee-policies')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class FeePoliciesController {
  constructor(private readonly feePoliciesService: FeePoliciesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.BILLING_FEE_POLICY_READ)
  list(@Query() query: FeePolicyListQueryDto) {
    return this.feePoliciesService.list(query.parkingLotId);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.BILLING_FEE_POLICY_READ)
  getById(@Param('id') id: string) {
    return this.feePoliciesService.getById(id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.BILLING_FEE_POLICY_MANAGE)
  create(@Body() dto: CreateFeePolicyDto) {
    return this.feePoliciesService.create(dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.BILLING_FEE_POLICY_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateFeePolicyDto) {
    return this.feePoliciesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.BILLING_FEE_POLICY_MANAGE)
  remove(@Param('id') id: string) {
    return this.feePoliciesService.remove(id);
  }
}