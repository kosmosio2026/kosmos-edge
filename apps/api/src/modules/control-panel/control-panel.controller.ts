import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Post,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions';

import { ControlPanelService } from './control-panel.service';
import { ServiceActionDto } from './dto/service-action.dto';
import { DisplayMessageDto } from './dto/display-message.dto';
import { DisplayPowerDto } from './dto/display-power.dto';
import { CreateControlServiceDto } from './dto/create-control-service.dto';
import { UpdateControlServiceDto } from './dto/update-control-service.dto';

@Controller('control-panel')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ControlPanelController {
  constructor(private readonly controlPanelService: ControlPanelService) {}

  @Get('status')
  @RequirePermission(PERMISSIONS.CONTROL_PANEL_READ)
  getStatus() {
    return this.controlPanelService.getStatus();
  }

  @Get('services')
  @RequirePermission(PERMISSIONS.CONTROL_PANEL_READ)
  listServices() {
    return this.controlPanelService.listServices();
  }

  @Post('services')
  @RequirePermission(PERMISSIONS.CONTROL_PANEL_MANAGE)
  createService(@Body() dto: CreateControlServiceDto) {
    return this.controlPanelService.createService(dto);
  }

  @Patch('services/:id')
  @RequirePermission(PERMISSIONS.CONTROL_PANEL_MANAGE)
  updateService(
    @Param('id') id: string,
    @Body() dto: UpdateControlServiceDto,
  ) {
    return this.controlPanelService.updateService(id, dto);
  }

  @Delete('services/:id')
  @RequirePermission(PERMISSIONS.CONTROL_PANEL_MANAGE)
  removeService(@Param('id') id: string) {
    return this.controlPanelService.removeService(id);
  }

  @Get('services/:service/logs')
  @RequirePermission(PERMISSIONS.CONTROL_PANEL_READ)
  serviceLogs(
    @Param('service') service: string,
    @Query('lines') lines?: string,
  ) {
    return this.controlPanelService.getServiceLogs(
      service,
      Number(lines ?? 120),
    );
  }

  @Post('services/:service/action')
  @RequirePermission(PERMISSIONS.CONTROL_PANEL_MANAGE)
  serviceAction(
    @Param('service') service: string,
    @Body() dto: ServiceActionDto,
  ) {
    return this.controlPanelService.serviceAction(service, dto.action);
  }

  @Post('hardware/display/message')
  @RequirePermission(PERMISSIONS.CONTROL_PANEL_MANAGE)
  sendDisplayMessage(@Body() dto: DisplayMessageDto) {
    return this.controlPanelService.sendDisplayMessage(dto);
  }

  @Post('hardware/display/power')
  @RequirePermission(PERMISSIONS.CONTROL_PANEL_MANAGE)
  setDisplayPower(@Body() dto: DisplayPowerDto) {
    return this.controlPanelService.setDisplayPower(dto);
  }
}
