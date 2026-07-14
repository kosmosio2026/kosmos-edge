import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { EdgeApiKeyGuard } from '../../common/guards/edge-api-key.guard';
import { EdgeCloudPushWorkerService } from './edge-cloud-push-worker.service';
import { EdgeSyncWorkerService } from './edge-sync-worker.service';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { EdgeLocalKeyBootstrapService } from './edge-local-key-bootstrap.service';

@Module({
  imports: [PrismaModule, InvoicesModule],
  controllers: [SyncController],
  providers: [
    EdgeLocalKeyBootstrapService,
    SyncService,
    EdgeApiKeyGuard,
    EdgeSyncWorkerService,
    EdgeCloudPushWorkerService,
  ],
  exports: [SyncService],
})
export class SyncModule {}