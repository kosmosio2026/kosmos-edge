import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RoleAdminService } from './role-admin.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { UpdateRoleMenuPoliciesDto } from './dto/update-role-menu-policies.dto';
import { UpdateRolePagePoliciesDto } from './dto/update-role-page-policies.dto';
import { UpdateUserScopesDto } from './dto/update-user-scopes.dto';

@Controller('rbac/admin')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RoleAdminController {
  constructor(private readonly roleAdminService: RoleAdminService) {}

  @Get('roles')
  @RequirePermission('rbac.manage')
  listRoles() {
    return this.roleAdminService.listRoles();
  }

  @Get('roles/:id')
  @RequirePermission('rbac.manage')
  getRoleById(@Param('id') id: string) {
    return this.roleAdminService.getRoleById(id);
  }

  @Post('roles')
  @RequirePermission('rbac.manage')
  createRole(@Body() dto: CreateRoleDto) {
    return this.roleAdminService.createRole(dto);
  }

  @Patch('roles/:id')
  @RequirePermission('rbac.manage')
  updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.roleAdminService.updateRole(id, dto);
  }

  @Get('menus')
  @RequirePermission('rbac.manage')
  listMenus() {
    return this.roleAdminService.listMenus();
  }

  @Get('pages')
  @RequirePermission('rbac.manage')
  listPages() {
    return this.roleAdminService.listPages();
  }

  @Put('roles/:id/permissions')
  @RequirePermission('rbac.manage')
  updateRolePermissions(
    @Param('id') id: string,
    @Body() dto: UpdateRolePermissionsDto,
  ) {
    return this.roleAdminService.updateRolePermissions(id, dto);
  }

  @Put('roles/:id/menu-policies')
  @RequirePermission('rbac.manage')
  updateRoleMenuPolicies(
    @Param('id') id: string,
    @Body() dto: UpdateRoleMenuPoliciesDto,
  ) {
    return this.roleAdminService.updateRoleMenuPolicies(id, dto);
  }

  @Put('roles/:id/page-policies')
  @RequirePermission('rbac.manage')
  updateRolePagePolicies(
    @Param('id') id: string,
    @Body() dto: UpdateRolePagePoliciesDto,
  ) {
    return this.roleAdminService.updateRolePagePolicies(id, dto);
  }

  @Get('users/:id/scopes')
  @RequirePermission('rbac.manage')
  getUserScopes(@Param('id') id: string) {
    return this.roleAdminService.getUserScopes(id);
  }

  @Put('users/:id/scopes')
  @RequirePermission('rbac.manage')
  updateUserScopes(@Param('id') id: string, @Body() dto: UpdateUserScopesDto) {
    return this.roleAdminService.updateUserScopes(id, dto);
  }
}