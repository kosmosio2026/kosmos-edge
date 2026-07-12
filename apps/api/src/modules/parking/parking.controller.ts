import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types/auth-user.type';
import { ParkingService } from './parking.service';

@Controller('parking')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ParkingController {
  constructor(private readonly parkingService: ParkingService) {}

  @Post('register')
  @RequirePermission('session.manage')
  register(
    @Body() dto: { parkingSpaceId: string },
    @CurrentUser() user: AuthUser,
  ) {
    return this.parkingService.register(dto.parkingSpaceId, user.sub);
  }

  @Get('active-session-by-space/:spaceId')
  @RequirePermission('session.manage')
  getActiveSessionBySpace(@Param('spaceId') spaceId: string) {
    return this.parkingService.getActiveSessionBySpace(spaceId);
  }
}