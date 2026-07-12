import { Module } from '@nestjs/common';

import { ParkingGateway } from './parking.gateway';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimePublisherService } from './realtime-publisher.service';

@Module({
  providers: [ParkingGateway, RealtimeGateway, RealtimePublisherService],
  exports: [RealtimePublisherService],
})
export class RealtimeModule {}
