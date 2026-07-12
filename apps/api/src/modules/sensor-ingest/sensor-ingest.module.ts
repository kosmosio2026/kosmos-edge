import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { SensorIngestController } from './sensor-ingest.controller';
import { SensorIngestService } from './sensor-ingest.service';

@Module({
  imports: [PrismaModule, InvoicesModule],
  controllers: [SensorIngestController],
  providers: [SensorIngestService],
  exports: [SensorIngestService],
})
export class SensorIngestModule {}