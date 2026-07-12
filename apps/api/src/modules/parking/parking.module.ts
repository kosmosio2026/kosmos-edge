import { Module } from '@nestjs/common';
import { MapsController } from './maps/maps.controller';
import { MapsService } from './maps/maps.service';
import { RbacModule } from '../rbac/rbac.module';
import { SessionService } from './session.service';
import { BillingModule } from '../billing/billing.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { ParkingController } from './parking.controller';
import { ParkingService } from './parking.service';
import { RedisPublisher } from '../../common/redis/redis.publisher';
import { FeeEngineService } from '../billing/fee-engine.service';

@Module({
  imports: [PrismaModule, RbacModule, BillingModule],
  controllers: [
    MapsController,
    ParkingController
  ],
  providers: [
    MapsService,
    ParkingService, 
    RedisPublisher,
    FeeEngineService
  ],
  exports: [ParkingService],
})
export class ParkingModule {}