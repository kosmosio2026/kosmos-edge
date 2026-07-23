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
import { Public } from '../../common/decorators/public.decorator';

import { DevicesService } from './devices.service';
import { CreateSensorDeviceDto } from './dto/create-sensor-device.dto';
import { UpdateSensorDeviceDto } from './dto/update-sensor-device.dto';
import { CreateSensorEventDto } from './dto/create-sensor-event.dto';
import { PERMISSIONS } from '../../common/rbac/permissions';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(PERMISSIONS.DEVICE_READ)
  listAlias(
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.devicesService.listDevices({ q, type, status });
  }

  @Get('list')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(PERMISSIONS.DEVICE_READ)
  listDevices(
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.devicesService.listDevices({ q, type, status });
  }

  @Get('sensors')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(PERMISSIONS.DEVICE_READ)
  listSensors(
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.devicesService.listDevices({
      q,
      type: type ?? 'PARKING_SENSOR',
      status,
    });
  }

  @Get('sensors/:id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission(PERMISSIONS.DEVICE_READ)
  getDeviceById(@Param('id') id: string) {
    return this.devicesService.getDeviceById(id);
  }

  @Post('validate-import')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('device.manage')
  validateImport(@Body() body: { rows?: Record<string, unknown>[] }) {
    return this.devicesService.validateImportRows(body.rows ?? []);
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('device.manage')
  createAlias(@Body() dto: CreateSensorDeviceDto) {
    return this.devicesService.createDevice(dto);
  }

  @Post('sensors')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('device.manage')
  createDevice(@Body() dto: CreateSensorDeviceDto) {
    return this.devicesService.createDevice(dto);
  }

  @Post('sensors/replace')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('device.manage')
  replaceSensorForSpace(
    @Body()
    dto: {
      parkingSpaceId: string;
      type?: string;
      devEui: string;
      serialNumber?: string;
      name?: string;
    },
  ) {
    return this.devicesService.replaceSensorForSpace(dto);
  }

  @Patch('sensors/:id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('device.manage')
  updateDevice(
    @Param('id') id: string,
    @Body() dto: UpdateSensorDeviceDto,
  ) {
    return this.devicesService.updateDevice(id, dto);
  }

  @Patch('sensors/:id/map-space')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('device.manage')
  mapDeviceToSpace(
    @Param('id') id: string,
    @Body() dto: { parkingSpaceId?: string | null },
  ) {
    return this.devicesService.mapDeviceToSpace(id, dto.parkingSpaceId ?? null);
  }

  @Delete('sensors/:id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('device.manage')
  deleteDevice(@Param('id') id: string) {
    return this.devicesService.deleteDevice(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('device.manage')
  deleteAlias(@Param('id') id: string) {
    return this.devicesService.deleteDevice(id);
  }

  @Post('link-sensor-to-space')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('device.manage')
  linkSensorToSpace(
    @Body()
    dto: {
      devEui: string;
      parkingSpaceId: string;
    },
  ) {
    return this.devicesService.linkSensorToSpace(
      dto.devEui,
      dto.parkingSpaceId,
    );
  }

  @Public()
  @Post('sensor-events')
  ingestSensorEvent(@Body() dto: CreateSensorEventDto) {
    return this.devicesService.ingestSensorEvent(dto);
  }

  @Public()
  @Post('anpr')
  handleANPR(@Body() dto: { plateNumber: string }) {
    return this.devicesService.handleANPR(dto.plateNumber);
  }
}