import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { isConnectedEdgeProfile } from '../../common/config/app-mode';
import { SyncService } from './sync.service';

type CloudPullMessage = {
  cursor: string;
  outboxId?: string;
  eventType: string;
  payload: Record<string, unknown>;
};

type CloudPullResponse = {
  ok: boolean;
  edgeNodeId: string;
  count: number;
  messages: CloudPullMessage[];
};

type WorkerRunResult = {
  ok: true;
  enabled: boolean;
  running: boolean;
  pulledCount: number;
  appliedCount: number;
  ackedCount: number;
  skippedCount: number;
  failedCount: number;
  startedAt: string;
  finishedAt: string;
  error: string | null;
};

@Injectable()
export class EdgeSyncWorkerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(EdgeSyncWorkerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  private lastRunAt: string | null = null;
  private lastSuccessAt: string | null = null;
  private lastErrorAt: string | null = null;
  private lastError: string | null = null;

  private lastPulledCount = 0;
  private lastAppliedCount = 0;
  private lastAckedCount = 0;
  private lastSkippedCount = 0;
  private lastFailedCount = 0;

  constructor(private readonly syncService: SyncService) {}

  onModuleInit() {
    const enabled = this.shouldRun();

    this.logger.log(
      [
        `Edge sync worker init.`,
        `enabled=${enabled}`,
        `APP_MODE=${process.env.APP_PROFILE ?? process.env.APP_MODE ?? 'undefined'}`,
        `EDGE_SYNC_WORKER_ENABLED=${
          process.env.EDGE_SYNC_WORKER_ENABLED ?? 'undefined'
        }`,
        `EDGE_NODE_ID=${process.env.EDGE_NODE_ID ?? 'undefined'}`,
        `CLOUD_API_BASE_URL=${
          process.env.CLOUD_API_BASE_URL ?? 'undefined'
        }`,
      ].join(' '),
    );

    if (!enabled) {
      this.logger.log('Edge sync worker disabled');
      return;
    }

    const intervalMs = this.getIntervalMs();

    this.logger.log(
      `Edge sync worker enabled. intervalMs=${intervalMs}`,
    );

    this.timer = setInterval(() => {
      void this.runOnce();
    }, intervalMs);

    void this.runOnce();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getStatus() {
    return {
      ok: true,
      enabled: this.shouldRun(),
      running: this.running,
      intervalMs: this.getIntervalMs(),
      pullLimit: this.getPullLimit(),
      appMode: process.env.APP_PROFILE ?? process.env.APP_MODE ?? null,
      edgeNodeId: process.env.EDGE_NODE_ID ?? null,
      cloudApiBaseUrl:
        process.env.CLOUD_API_BASE_URL ??
        process.env.PUBLIC_CLOUD_API_BASE_URL ??
        process.env.API_BASE_URL ??
        null,

      lastRunAt: this.lastRunAt,
      lastSuccessAt: this.lastSuccessAt,
      lastErrorAt: this.lastErrorAt,
      lastError: this.lastError,

      lastPulledCount: this.lastPulledCount,
      lastAppliedCount: this.lastAppliedCount,
      lastAckedCount: this.lastAckedCount,
      lastSkippedCount: this.lastSkippedCount,
      lastFailedCount: this.lastFailedCount,
    };
  }

  async runOnce(): Promise<WorkerRunResult> {
    const startedAt = new Date().toISOString();

    if (!this.shouldRun()) {
      const result: WorkerRunResult = {
        ok: true,
        enabled: false,
        running: this.running,
        pulledCount: 0,
        appliedCount: 0,
        ackedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        startedAt,
        finishedAt: new Date().toISOString(),
        error: null,
      };

      this.logger.log('Edge sync worker run skipped because it is disabled');

      return result;
    }

    if (this.running) {
      return {
        ok: true,
        enabled: true,
        running: true,
        pulledCount: 0,
        appliedCount: 0,
        ackedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        startedAt,
        finishedAt: new Date().toISOString(),
        error: null,
      };
    }

    this.running = true;
    this.lastRunAt = startedAt;

    let pulledCount = 0;
    let appliedCount = 0;
    let ackedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let errorMessage: string | null = null;

    try {
      const messages = await this.pullFromCloud();
      pulledCount = messages.length;

      this.logger.log(
        `Edge sync worker pulled ${messages.length} cloud sync message(s)`,
      );

      for (const message of messages) {
        const result = await this.applyAndAck(message);

        if (result.applied) appliedCount += 1;
        if (result.acked) ackedCount += 1;
        if (result.skipped) skippedCount += 1;
        if (result.failed) failedCount += 1;
      }

      this.lastSuccessAt = new Date().toISOString();
      this.lastError = null;
      this.lastErrorAt = null;
    } catch (error) {
      errorMessage = this.errorMessage(error);
      failedCount += 1;

      this.lastError = errorMessage;
      this.lastErrorAt = new Date().toISOString();

      this.logger.error(
        `Edge sync worker failed: ${errorMessage}`,
      );
    } finally {
      this.running = false;

      this.lastPulledCount = pulledCount;
      this.lastAppliedCount = appliedCount;
      this.lastAckedCount = ackedCount;
      this.lastSkippedCount = skippedCount;
      this.lastFailedCount = failedCount;
    }

    const finishedAt = new Date().toISOString();

    this.logger.log(
      `Edge sync worker run finished. pulled=${pulledCount}, applied=${appliedCount}, acked=${ackedCount}, skipped=${skippedCount}, failed=${failedCount}`,
    );

    return {
      ok: true,
      enabled: true,
      running: false,
      pulledCount,
      appliedCount,
      ackedCount,
      skippedCount,
      failedCount,
      startedAt,
      finishedAt,
      error: errorMessage,
    };
  }

  private async pullFromCloud() {
    const cloudApiBaseUrl = this.getCloudApiBaseUrl();
    const edgeApiKey = this.getEdgeApiKey();
    const limit = this.getPullLimit();

    const url = `${cloudApiBaseUrl}/sync/edge/pull?limit=${limit}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-edge-api-key': edgeApiKey,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Cloud pull failed: ${response.status} ${response.statusText}`,
      );
    }

    const body = (await response.json()) as CloudPullResponse;

    if (!body.ok || !Array.isArray(body.messages)) {
      throw new Error('Cloud pull returned invalid response');
    }

    return body.messages;
  }

  private async applyAndAck(message: CloudPullMessage) {
    const cursor = message.cursor ?? message.outboxId;

    if (!cursor) {
      this.logger.warn(
        `Skipping cloud message without cursor: ${message.eventType}`,
      );

      return {
        applied: false,
        acked: false,
        skipped: true,
        failed: false,
      };
    }

    try {
      const edgeNodeId = this.getLocalEdgeNodeId();

      const applyResult =
        await this.syncService.applyCloudMessageOnEdge(edgeNodeId, {
          cursor,
          eventType: message.eventType,
          payload: message.payload,
        });

      if (!applyResult?.ok || applyResult.applied === false) {
        this.logger.warn(
          `Cloud message not applied. cursor=${cursor}, eventType=${message.eventType}, action=${applyResult?.action}`,
        );

        return {
          applied: false,
          acked: false,
          skipped: true,
          failed: false,
        };
      }

      await this.ackToCloud(cursor);

      this.logger.log(
        `Applied and acked cloud message. cursor=${cursor}, eventType=${message.eventType}`,
      );

      return {
        applied: true,
        acked: true,
        skipped: false,
        failed: false,
      };
    } catch (error) {
      this.logger.error(
        `Cloud message apply/ack failed. cursor=${cursor}, eventType=${message.eventType}, error=${this.errorMessage(
          error,
        )}`,
      );

      return {
        applied: false,
        acked: false,
        skipped: false,
        failed: true,
      };
    }
  }

  private async ackToCloud(cursor: string) {
    const cloudApiBaseUrl = this.getCloudApiBaseUrl();
    const edgeApiKey = this.getEdgeApiKey();

    const response = await fetch(`${cloudApiBaseUrl}/sync/edge/ack`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-edge-api-key': edgeApiKey,
      },
      body: JSON.stringify({
        cursor,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Cloud ack failed: ${response.status} ${response.statusText}`,
      );
    }

    const body = (await response.json()) as {
      ok?: boolean;
      outboxAcked?: boolean;
    };

    if (!body.ok || !body.outboxAcked) {
      throw new Error(
        `Cloud ack returned unexpected response for cursor=${cursor}`,
      );
    }
  }

  private shouldRun() {
    const enabled =
      (
        process.env.EDGE_SYNC_WORKER_ENABLED ??
        'false'
      ).toLowerCase() === 'true';

    return isConnectedEdgeProfile() && enabled;
  }

  private getCloudApiBaseUrl() {
    const value =
      process.env.CLOUD_API_BASE_URL ??
      process.env.PUBLIC_CLOUD_API_BASE_URL ??
      process.env.API_BASE_URL;

    if (!value) {
      throw new Error(
        'CLOUD_API_BASE_URL is required for Edge sync worker',
      );
    }

    return value.replace(/\/+$/, '');
  }

  private getEdgeApiKey() {
    const value =
      process.env.EDGE_API_KEY ??
      process.env.DEV_EDGE_API_KEY ??
      process.env.SYNC_EDGE_API_KEY;

    if (!value) {
      throw new Error(
        'EDGE_API_KEY or DEV_EDGE_API_KEY is required for Edge sync worker',
      );
    }

    return value;
  }

  private getLocalEdgeNodeId() {
    const value = process.env.EDGE_NODE_ID;

    if (!value) {
      throw new Error('EDGE_NODE_ID is required for Edge sync worker');
    }

    return value;
  }

  private getIntervalMs() {
    const raw = process.env.EDGE_SYNC_WORKER_INTERVAL_MS;
    const parsed = raw ? Number(raw) : 10_000;

    if (!Number.isFinite(parsed) || parsed < 1_000) {
      return 10_000;
    }

    return Math.floor(parsed);
  }

  private getPullLimit() {
    const raw = process.env.EDGE_SYNC_PULL_LIMIT;
    const parsed = raw ? Number(raw) : 20;

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 20;
    }

    return Math.min(Math.floor(parsed), 100);
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}