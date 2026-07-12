import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SyncService } from './sync.service';
import { EdgeSyncWorkerService } from './edge-sync-worker.service';
import { EdgeCloudPushWorkerService } from './edge-cloud-push-worker.service';
import { EdgeApiKeyGuard } from '../../common/guards/edge-api-key.guard';
import {
  CurrentEdge,
  CurrentEdgeContext,
} from '../../common/decorators/current-edge.decorator';

type EdgePushDto = {
  events: Array<{
    eventId?: string;
    eventType: string;
    aggregateType?: string;
    aggregateId?: string;
    occurredAt?: string;
    payload: Record<string, unknown>;
  }>;
};

type EdgeAckDto = {
  cursor: string;
};

type EdgeApplyDto = {
  cursor?: string;
  outboxId?: string;
  eventType?: string;
  payload?: Record<string, unknown>;
  message?: {
    cursor?: string;
    outboxId?: string;
    eventType?: string;
    payload?: Record<string, unknown>;
  };
};

@Controller('sync/edge')
@UseGuards(EdgeApiKeyGuard)
export class SyncController {
  constructor(
    private readonly syncService: SyncService,
    private readonly edgeSyncWorkerService: EdgeSyncWorkerService,
    private readonly edgeCloudPushWorkerService: EdgeCloudPushWorkerService,
  ) {}

  @Post('push')
  push(
    @CurrentEdge() edge: CurrentEdgeContext,
    @Body() dto: EdgePushDto,
  ) {
    return this.syncService.pushFromEdge(edge.edgeNodeId, dto.events);
  }

  @Get('pull')
  pull(
    @CurrentEdge() edge: CurrentEdgeContext,
    @Query('limit') limit?: string,
  ) {
    return this.syncService.pullForEdge(
      edge.edgeNodeId,
      limit ? Number(limit) : undefined,
    );
  }

  @Post('apply')
  apply(
    @CurrentEdge() edge: CurrentEdgeContext,
    @Body() dto: EdgeApplyDto,
  ) {
    return this.syncService.applyCloudMessageOnEdge(edge.edgeNodeId, dto);
  }

  @Get('worker/status')
  workerStatus() {
    return this.edgeSyncWorkerService.getStatus();
  }

  @Post('worker/run-once')
  workerRunOnce() {
    return this.edgeSyncWorkerService.runOnce();
  }

  @Get('worker/cloud-push/status')
  cloudPushWorkerStatus() {
    return this.edgeCloudPushWorkerService.getStatus();
  }

  @Post('worker/cloud-push/run-once')
  cloudPushWorkerRunOnce() {
    return this.edgeCloudPushWorkerService.runOnce();
  }

  @Post('ack')
  ack(
    @CurrentEdge() edge: CurrentEdgeContext,
    @Body() dto: EdgeAckDto,
  ) {
    return this.syncService.ackFromEdge(edge.edgeNodeId, dto.cursor);
  }
}