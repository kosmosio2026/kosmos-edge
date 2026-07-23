import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../../common/rbac/permissions';
import type { AuthUser } from '../../../common/types/auth-user.type';
import { DeviceFaultsService } from './device-faults.service';
import { CreateDeviceFaultDto } from '../dto/create-device-fault.dto';
import { UpdateDeviceFaultDto } from '../dto/update-device-fault.dto';

@Controller('devices/faults')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DeviceFaultsController {
  constructor(private readonly deviceFaultsService: DeviceFaultsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.DEVICE_FAULT_READ)
  listFaults(@CurrentUser() user: AuthUser) {
    return this.deviceFaultsService.listFaults(user);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.DEVICE_FAULT_READ)
  getFaultById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.deviceFaultsService.getFaultById(id, user);
  }

  @Post()
  @RequirePermission(PERMISSIONS.DEVICE_FAULT_ACKNOWLEDGE)
  createFault(@Body() dto: CreateDeviceFaultDto, @CurrentUser() user: AuthUser) {
    return this.deviceFaultsService.createFault(dto, user);
  }

  @Post(':id/action')
  @RequirePermission(PERMISSIONS.DEVICE_FAULT_ACKNOWLEDGE)
  registerAction(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.deviceFaultsService.registerAction(id, body, user);
  }

  @Post(':id/close')
  @RequirePermission(PERMISSIONS.DEVICE_FAULT_RESOLVE)
  closeFault(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() user: AuthUser,
  ) {
    return this.deviceFaultsService.closeFault(id, body, user);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.DEVICE_FAULT_ACKNOWLEDGE)
  updateFault(
    @Param('id') id: string,
    @Body() dto: UpdateDeviceFaultDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.deviceFaultsService.updateFault(id, dto, user);
  }
}
