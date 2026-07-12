import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RbacAdminPageService } from './rbac-admin-page.service';

@Controller('rbac/admin-page')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RbacAdminPageController {
  constructor(private readonly rbacAdminPageService: RbacAdminPageService) {}

  @Get('matrix')
  @RequirePermission('rbac.manage')
  getMatrix() {
    return this.rbacAdminPageService.getMatrix();
  }
}