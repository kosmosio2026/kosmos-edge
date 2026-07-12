import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParkingRegistrationService } from './parking-registration.service';

type RegisterParkingDto = {
  sessionId?: string;
  parkingSpaceId?: string;
  plateNumber?: string;
  vehicleNo?: string;
  driverName?: string;
  phone?: string;
  registrationSource?: string;
  note?: string;
};

@Controller('parking-registration')
@UseGuards(JwtAuthGuard)
export class ParkingRegistrationController {
  constructor(
    private readonly parkingRegistrationService: ParkingRegistrationService,
  ) {}

  @Post('register')
  register(
    @CurrentUser() user: any,
    @Body() dto: RegisterParkingDto,
  ) {
    return this.parkingRegistrationService.registerActiveSession({
      userId: user.sub ?? user.id,
      roles: user.roles ?? [],
      dto,
    });
  }
}