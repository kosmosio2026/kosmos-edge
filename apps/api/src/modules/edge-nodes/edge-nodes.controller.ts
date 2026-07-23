import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AppModeGuard } from '../../common/guards/app-mode.guard';
import { AppProfileOnly } from '../../common/decorators/app-mode.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user.type';
import { EdgeNodesService } from './edge-nodes.service';

@Controller('edge-nodes')
@UseGuards(JwtAuthGuard, AppModeGuard)
@AppProfileOnly('cloud')
export class EdgeNodesController {
  constructor(private readonly edgeNodesService: EdgeNodesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser | undefined) {
    return this.edgeNodesService.list(user);
  }

  @Get('options/tenants')
  listTenantOptions(@CurrentUser() user: AuthUser | undefined) {
    return this.edgeNodesService.listTenantOptions(user);
  }

  @Get('options/parking-lots')
  listParkingLotOptions(@CurrentUser() user: AuthUser | undefined) {
    return this.edgeNodesService.listParkingLotOptions(user);
  }


  @Get(':id/audit-logs')
  listAuditLogs(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser | undefined,
  ) {
    return this.edgeNodesService.listAuditLogs(user, id);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id') id: string,
  ) {
    return this.edgeNodesService.get(user, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser | undefined,
    @Body() body: unknown,
  ) {
    return this.edgeNodesService.create(user, body as never);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.edgeNodesService.update(user, id, body as never);
  }

  @Delete(':id')
  softDelete(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id') id: string,
  ) {
    return this.edgeNodesService.softDelete(user, id);
  }


  @Post(':id/keys')
  issueKey(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser | undefined,
    @Body() body: { revokeExistingActiveKeys?: boolean } = {},
  ) {
    return this.edgeNodesService.issueKey(id, user, body);
  }

  @Post(':id/keys/:keyId/revoke')
  revokeKey(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id') id: string,
    @Param('keyId') keyId: string,
  ) {
    return this.edgeNodesService.revokeKey(user, id, keyId);
  }

  @Post(':id/parking-lots')
  attachParkingLot(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.edgeNodesService.attachParkingLot(user, id, body as never);
  }

  @Delete(':id/parking-lots/:parkingLotId')
  detachParkingLot(
    @CurrentUser() user: AuthUser | undefined,
    @Param('id') id: string,
    @Param('parkingLotId') parkingLotId: string,
  ) {
    return this.edgeNodesService.detachParkingLot(user, id, parkingLotId);
  }
}
