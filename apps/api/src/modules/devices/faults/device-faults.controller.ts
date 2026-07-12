import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { DeviceFaultsService } from './device-faults.service';
import { CreateDeviceFaultDto } from '../dto/create-device-fault.dto';
import { UpdateDeviceFaultDto } from '../dto/update-device-fault.dto';

@Controller('devices/faults')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DeviceFaultsController {
  constructor(private readonly deviceFaultsService: DeviceFaultsService) {}

  @Get()
  @RequirePermission('device.manage')
  listFaults() {
    return this.deviceFaultsService.listFaults();
  }

  @Get(':id')
  @RequirePermission('device.manage')
  getFaultById(@Param('id') id: string) {
    return this.deviceFaultsService.getFaultById(id);
  }

  @Post()
  @RequirePermission('device.manage')
  createFault(@Body() dto: CreateDeviceFaultDto) {
    return this.deviceFaultsService.createFault(dto);
  }

  @Patch(':id')
  @RequirePermission('device.manage')
  updateFault(@Param('id') id: string, @Body() dto: UpdateDeviceFaultDto) {
    return this.deviceFaultsService.updateFault(id, dto);
  }
}