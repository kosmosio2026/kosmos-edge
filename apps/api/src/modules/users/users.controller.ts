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
import { UsersService } from './users.service';
import { UserListQueryDto } from './queries/user-list-query.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('managers')
  @RequirePermission(PERMISSIONS.USER_READ)
  findManagers() {
    return this.usersService.findStaffByRole('MANAGER');
  }

  @Get('operators')
  @RequirePermission(PERMISSIONS.USER_READ)
  findOperators() {
    return this.usersService.findStaffByRole('OPERATOR');
  }

  @Get('members')
  @RequirePermission(PERMISSIONS.USER_READ)
  findMembers() {
    return this.usersService.findMembers();
  }

  @Get('visitors')
  @RequirePermission(PERMISSIONS.USER_READ)
  findVisitors() {
    return this.usersService.findVisitors();
  }

  @Get()
  @RequirePermission(PERMISSIONS.USER_READ)
  list(@Query() query: UserListQueryDto) {
    return this.usersService.list(query);
  }

  @Get('pending/approvals')
  @RequirePermission(PERMISSIONS.USER_READ)
  listPendingApprovals() {
    return this.usersService.listPendingApprovals();
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.USER_READ)
  getById(@Param('id') id: string) {
    return this.usersService.getById(id);
  }

  @Post()
  @RequirePermission(PERMISSIONS.USER_MANAGE)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.USER_MANAGE)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.USER_MANAGE)
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Patch(':id/approve')
  @RequirePermission('rbac.manage')
  approve(
    @Param('id') id: string,
    @Body()
    body: {
      lotIds?: string[];
      sectionIds?: string[];
    },
  ) {
    return this.usersService.approve(id, {
      lotIds: body.lotIds ?? [],
      sectionIds: body.sectionIds ?? [],
    });
  }

  @Patch(':id/reject')
  @RequirePermission('rbac.manage')
  reject(@Param('id') id: string) {
    return this.usersService.reject(id);
  }
}
