import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { ParkingSessionsService } from './parking-sessions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthUser } from '../../common/types/auth-user.type';

@Controller('parking-sessions')
@UseGuards(JwtAuthGuard)
export class ParkingSessionsController {
  constructor(
    private readonly parkingSessionsService: ParkingSessionsService,
  ) {}


  @Get('recent-events')
  getRecentEvents(@Query('limit') limit?: string) {
    return this.parkingSessionsService.getRecentEvents({
      limit: limit ? Number(limit) : 10,
    });
  }

  @Get()
  getSessions(
    @CurrentUser() user: AuthUser,
    @Query('parkingLotId') parkingLotId?: string,
    @Query('status') status?: string,
  ) {
    return this.parkingSessionsService.getSessions({
      user,
      parkingLotId,
      status,
    });
  }



  @Post(':id/registration-photo')
  addRegistrationPhoto(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
    dto: {
      imageUrl?: string;
      photoType?: string;
      required?: boolean;
    },
  ) {
    return this.parkingSessionsService.addRegistrationPhoto(user.sub, id, dto);
  }

  @Post(':id/manual-payment')
  recordManualPayment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
    dto: {
      amount?: number;
      paymentMethod?: string;
      collectedAt?: string;
      note?: string;
    },
  ) {
    return this.parkingSessionsService.recordManualPayment(user.sub, id, dto);
  }

  @Patch(':id/register')
  registerSession(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body()
    dto: {
      plateNumber?: string | null;
      contactNumber?: string | null;
    },
  ) {
    return this.parkingSessionsService.registerSession(user.sub, id, dto);
  }
}