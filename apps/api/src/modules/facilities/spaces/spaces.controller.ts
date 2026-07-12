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
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { PERMISSIONS } from '../../../common/rbac/permissions';
import type { AuthUser } from '../../../common/types/auth-user.type';
import { SpacesService } from './spaces.service';

@Controller('facilities/spaces')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SpacesController {
  constructor(private readonly service: SpacesService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PARKING_SPACE_READ)
  list(@Query() q: any, @CurrentUser() user: AuthUser) {
    return this.service.list(q, user);
  }

  @Post()
  @RequirePermission(PERMISSIONS.PARKING_SPACE_WRITE)
  create(@Body() dto: any) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.PARKING_SPACE_WRITE)
  update(@Param('id') id: string, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.PARKING_SPACE_WRITE)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
