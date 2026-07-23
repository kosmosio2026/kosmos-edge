import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { SensorEventsService } from './sensor-events.service';

@Controller('devices/sensor-events')
export class SensorEventsController {
  constructor(private readonly sensorEventsService: SensorEventsService) {}

  // Called by Rust mqtt-daemon.
  // Keep this public inside trusted LAN, or protect later with API key guard.
  @Post()
  ingest(@Body() body: any) {
    return this.sensorEventsService.ingest(body);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('device.read')
  recent(
    @Query('limit') limit?: string,
    @Query('devEui') devEui?: string,
  ) {
    return this.sensorEventsService.recent(Number(limit ?? 100), devEui);
  }
}
