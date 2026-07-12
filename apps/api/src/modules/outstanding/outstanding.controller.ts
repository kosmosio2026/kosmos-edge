import { Controller, Get, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PERMISSIONS } from '../../common/rbac/permissions';

import { OutstandingService } from './outstanding.service';

@Controller('outstanding')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OutstandingController {
  constructor(private readonly outstandingService: OutstandingService) {}

  @Get()
  @RequirePermission(PERMISSIONS.OUTSTANDING_READ)
  list() {
    return this.outstandingService.list();
  }
}
