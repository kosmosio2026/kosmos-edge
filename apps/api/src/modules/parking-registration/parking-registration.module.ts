import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ParkingRegistrationController } from './parking-registration.controller';
import { ParkingRegistrationService } from './parking-registration.service';

@Module({
  imports: [PrismaModule],
  controllers: [ParkingRegistrationController],
  providers: [ParkingRegistrationService],
  exports: [ParkingRegistrationService],
})
export class ParkingRegistrationModule {}