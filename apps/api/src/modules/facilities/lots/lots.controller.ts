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
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { PERMISSIONS } from '../../../common/rbac/permissions';
import { LotsService } from './lots.service';
import { CreateParkingLotDto } from './dto/create-parking-lot.dto';
import { UpdateParkingLotDto } from './dto/update-parking-lot.dto';
import type { AuthUser } from '../../../common/types/auth-user.type';

@Controller('facilities/lots')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class LotsController {
  constructor(private readonly lotsService: LotsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PARKING_LOT_READ)
  findAll(@CurrentUser() user: AuthUser) {
    return this.lotsService.findAll(user);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.PARKING_LOT_READ)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.lotsService.findOne(id, user);
  }

  @Post()
  @RequirePermission(PERMISSIONS.PARKING_SECTION_WRITE)
  create(@Body() dto: CreateParkingLotDto) {
    return this.lotsService.create(dto);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.PARKING_SECTION_WRITE)
  update(@Param('id') id: string, @Body() dto: UpdateParkingLotDto) {
    return this.lotsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.PARKING_SECTION_WRITE)
  remove(@Param('id') id: string) {
    return this.lotsService.remove(id);
  }
}