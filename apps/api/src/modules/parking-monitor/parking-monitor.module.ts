import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../prisma/prisma.module';
import { RbacModule } from '../rbac/rbac.module';
import { FeesModule } from '../fees/fees.module';
import { ParkingMonitorService } from './parking-monitor.service';
import { ParkingMonitorController } from './parking-monitor.controller';

@Module({
  imports: [RbacModule, PrismaModule, FeesModule, ScheduleModule.forRoot()],
  controllers: [ParkingMonitorController],
  providers: [ParkingMonitorService],
  exports: [ParkingMonitorService],
})
export class ParkingMonitorModule {}
