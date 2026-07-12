import { Module } from '@nestjs/common';
import { ParkingSessionsController } from './parking-sessions.controller';
import { ParkingSessionsService } from './parking-sessions.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ParkingSessionsController],
  providers: [ParkingSessionsService],
  exports: [ParkingSessionsService],
})
export class ParkingSessionsModule {}