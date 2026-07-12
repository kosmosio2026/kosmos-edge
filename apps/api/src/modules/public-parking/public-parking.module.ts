import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PublicParkingController } from './public-parking.controller';
import { PublicParkingService } from './public-parking.service';

@Module({
  imports: [PrismaModule],
  controllers: [PublicParkingController],
  providers: [PublicParkingService],
  exports: [PublicParkingService],
})
export class PublicParkingModule {}
