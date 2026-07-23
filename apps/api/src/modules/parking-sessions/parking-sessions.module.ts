import { Module } from '@nestjs/common';
import { ParkingSessionsController } from './parking-sessions.controller';
import { ParkingSessionsService } from './parking-sessions.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [PrismaModule, BillingModule],
  controllers: [ParkingSessionsController],
  providers: [ParkingSessionsService],
  exports: [ParkingSessionsService],
})
export class ParkingSessionsModule {}