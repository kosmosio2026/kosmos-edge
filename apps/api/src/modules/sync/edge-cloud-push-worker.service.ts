import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type CloudPushEvent = {
  eventId: string;
  eventType: string;
  aggregateType?: string | null;
  aggregateId?: string | null;
  occurredAt?: string;
  payload: Record<string, unknown>;
};

type CloudPushResponse = {
  ok?: boolean;
  accepted?: number;
  rejected?: number;
  processed?: number;
  results?: Array<{
    ok?: boolean;
    eventId?: string | null;
    messageId?: string;
    inboxId?: string;
    processed?: boolean;
    action?: string;
    invoice?: Record<string, unknown> | null;
    error?: string | null;
  }>;
};

type WorkerRunResult = {
  ok: true;
  enabled: boolean;
  running: boolean;
  bootstrappedCount: number;
  pushedCount: number;
  ackedCount: number;
  failedCount: number;
  skippedCount: number;
  startedAt: string;
  finishedAt: string;
  error: string | null;
};

const EDGE_TO_CLOUD_EVENT_TYPES = [
  'PARKING_SESSION_EXITED_UNPAID_EDGE_SYNC_REQUIRED',
];

@Injectable()
export class EdgeCloudPushWorkerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(EdgeCloudPushWorkerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  private lastRunAt: string | null = null;
  private lastSuccessAt: string | null = null;
  private lastErrorAt: string | null = null;
  private lastError: string | null = null;

  private lastBootstrappedCount = 0;
  private lastPushedCount = 0;
  private lastAckedCount = 0;
  private lastFailedCount = 0;
  private lastSkippedCount = 0;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const enabled = this.shouldRun();

    this.logger.log(
      [
        `Edge cloud push worker init.`,
        `enabled=${enabled}`,
        `APP_MODE=${process.env.APP_MODE ?? 'undefined'}`,
        `EDGE_CLOUD_PUSH_WORKER_ENABLED=${
          process.env.EDGE_CLOUD_PUSH_WORKER_ENABLED ?? 'undefined'
        }`,
        `EDGE_NODE_ID=${process.env.EDGE_NODE_ID ?? 'undefined'}`,
        `CLOUD_API_BASE_URL=${
          process.env.CLOUD_API_BASE_URL ?? 'undefined'
        }`,
      ].join(' '),
    );

    if (!enabled) {
      this.logger.log('Edge cloud push worker disabled');
      return;
    }

    const intervalMs = this.getIntervalMs();

    this.logger.log(
      `Edge cloud push worker enabled. intervalMs=${intervalMs}`,
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
      pushLimit: this.getPushLimit(),
      appMode: process.env.APP_MODE ?? null,
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

      lastBootstrappedCount: this.lastBootstrappedCount,
      lastPushedCount: this.lastPushedCount,
      lastAckedCount: this.lastAckedCount,
      lastFailedCount: this.lastFailedCount,
      lastSkippedCount: this.lastSkippedCount,
    };
  }

  async runOnce(): Promise<WorkerRunResult> {
    const startedAt = new Date().toISOString();

    if (!this.shouldRun()) {
      this.logger.log(
        'Edge cloud push worker run skipped because it is disabled',
      );

      return {
        ok: true,
        enabled: false,
        running: this.running,
        bootstrappedCount: 0,
        pushedCount: 0,
        ackedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        startedAt,
        finishedAt: new Date().toISOString(),
        error: null,
      };
    }

    if (this.running) {
      return {
        ok: true,
        enabled: true,
        running: true,
        bootstrappedCount: 0,
        pushedCount: 0,
        ackedCount: 0,
        failedCount: 0,
        skippedCount: 0,
        startedAt,
        finishedAt: new Date().toISOString(),
        error: null,
      };
    }

    this.running = true;
    this.lastRunAt = startedAt;

    let bootstrappedCount = 0;
    let pushedCount = 0;
    let ackedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    let errorMessage: string | null = null;

    try {
      bootstrappedCount = await this.bootstrapPendingOutboxMessages();

      const pendingMessages = await this.findPendingOutboxMessages();

      this.logger.log(
        `Edge cloud push worker found ${pendingMessages.length} pending cloud push message(s). bootstrapped=${bootstrappedCount}`,
      );

      for (const outbox of pendingMessages) {
        const result = await this.pushOneOutbox(outbox);

        if (result.pushed) pushedCount += 1;
        if (result.acked) ackedCount += 1;
        if (result.failed) failedCount += 1;
        if (result.skipped) skippedCount += 1;
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
        `Edge cloud push worker failed: ${errorMessage}`,
      );
    } finally {
      this.running = false;

      this.lastBootstrappedCount = bootstrappedCount;
      this.lastPushedCount = pushedCount;
      this.lastAckedCount = ackedCount;
      this.lastFailedCount = failedCount;
      this.lastSkippedCount = skippedCount;
    }

    const finishedAt = new Date().toISOString();

    this.logger.log(
      `Edge cloud push worker run finished. bootstrapped=${bootstrappedCount}, pushed=${pushedCount}, acked=${ackedCount}, skipped=${skippedCount}, failed=${failedCount}`,
    );

    return {
      ok: true,
      enabled: true,
      running: false,
      bootstrappedCount,
      pushedCount,
      ackedCount,
      failedCount,
      skippedCount,
      startedAt,
      finishedAt,
      error: errorMessage,
    };
  }

  private async bootstrapPendingOutboxMessages() {
    const take = this.getBootstrapLimit();

    const domainEvents = await this.prisma.domainEvent.findMany({
      where: {
        eventType: {
          in: EDGE_TO_CLOUD_EVENT_TYPES,
        },
      },
      orderBy: {
        occurredAt: 'asc',
      },
      take,
    });

    let created = 0;

    for (const domainEvent of domainEvents) {
      const existing = await this.prisma.syncOutbox.findFirst({
        where: {
          domainEventId: domainEvent.id,
          destination: 'CLOUD',
        },
      });

      if (existing) {
        continue;
      }

      await this.prisma.syncOutbox.create({
        data: {
          domainEventId: domainEvent.id,
          destination: 'CLOUD',
          status: 'PENDING' as any,
        },
      });

      created += 1;
    }

    return created;
  }

  private async findPendingOutboxMessages() {
    const take = this.getPushLimit();

    return this.prisma.syncOutbox.findMany({
      where: {
        destination: 'CLOUD',
        status: 'PENDING' as any,
        OR: [
          {
            nextRetryAt: null,
          },
          {
            nextRetryAt: {
              lte: new Date(),
            },
          },
        ],
      },
      include: {
        domainEvent: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take,
    });
  }

  private async pushOneOutbox(outbox: any) {
    const domainEvent = outbox.domainEvent;

    if (!domainEvent) {
      await this.markOutboxFailed(
        outbox.id,
        'Missing domainEvent relation',
      );

      return {
        pushed: false,
        acked: false,
        failed: true,
        skipped: false,
      };
    }

    try {
      const event = this.toCloudPushEvent(domainEvent);
      const response = await this.pushEventsToCloud([event]);
      const result = this.findPushResult(response, event.eventId);

      if (!response.ok || !result?.ok) {
        const reason =
          result?.error ??
          `Cloud push rejected eventId=${event.eventId}`;

        await this.markOutboxFailed(outbox.id, reason);

        this.logger.warn(
          `Edge cloud push rejected. outboxId=${outbox.id}, eventId=${event.eventId}, error=${reason}`,
        );

        return {
          pushed: true,
          acked: false,
          failed: true,
          skipped: false,
        };
      }

      await this.markOutboxAcked(outbox.id);

      this.logger.log(
        `Edge cloud push acked. outboxId=${outbox.id}, eventType=${event.eventType}, eventId=${event.eventId}, action=${result.action}`,
      );

      return {
        pushed: true,
        acked: true,
        failed: false,
        skipped: false,
      };
    } catch (error) {
      const message = this.errorMessage(error);

      await this.markOutboxFailed(outbox.id, message);

      this.logger.error(
        `Edge cloud push failed. outboxId=${outbox.id}, error=${message}`,
      );

      return {
        pushed: false,
        acked: false,
        failed: true,
        skipped: false,
      };
    }
  }

  private toCloudPushEvent(domainEvent: any): CloudPushEvent {
    return {
      eventId: domainEvent.eventId,
      eventType: domainEvent.eventType,
      aggregateType: domainEvent.aggregateType ?? null,
      aggregateId: domainEvent.aggregateId ?? null,
      occurredAt: domainEvent.occurredAt?.toISOString?.() ?? undefined,
      payload: this.asRecord(domainEvent.payload),
    };
  }

  private async pushEventsToCloud(events: CloudPushEvent[]) {
    const cloudApiBaseUrl = this.getCloudApiBaseUrl();
    const edgeApiKey = this.getEdgeApiKey();

    const response = await fetch(`${cloudApiBaseUrl}/sync/edge/push`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-edge-api-key': edgeApiKey,
      },
      body: JSON.stringify({
        events,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Cloud push failed: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as CloudPushResponse;
  }

  private findPushResult(response: CloudPushResponse, eventId: string) {
    if (!Array.isArray(response.results)) {
      return null;
    }

    return (
      response.results.find((item) => item.eventId === eventId) ??
      response.results.find((item) => item.messageId === eventId) ??
      null
    );
  }

  private async markOutboxAcked(outboxId: string) {
    return this.prisma.syncOutbox.update({
      where: {
        id: outboxId,
      },
      data: {
        status: 'ACKED' as any,
        sentAt: new Date(),
        ackedAt: new Date(),
        lastError: null,
      },
    });
  }

  private async markOutboxFailed(outboxId: string, error: string) {
    const outbox = await this.prisma.syncOutbox.findUnique({
      where: {
        id: outboxId,
      },
    });

    const retryCount = (outbox?.retryCount ?? 0) + 1;
    const retryDelayMs = this.getRetryDelayMs(retryCount);

    return this.prisma.syncOutbox.update({
      where: {
        id: outboxId,
      },
      data: {
        status: 'PENDING' as any,
        retryCount,
        nextRetryAt: new Date(Date.now() + retryDelayMs),
        lastError: error.slice(0, 1000),
      },
    });
  }

  private shouldRun() {
    const appMode = (process.env.APP_MODE ?? 'cloud').toLowerCase();
    const enabled =
      (
        process.env.EDGE_CLOUD_PUSH_WORKER_ENABLED ??
        'false'
      ).toLowerCase() === 'true';

    return appMode === 'edge' && enabled;
  }

  private getCloudApiBaseUrl() {
    const value =
      process.env.CLOUD_API_BASE_URL ??
      process.env.PUBLIC_CLOUD_API_BASE_URL ??
      process.env.API_BASE_URL;

    if (!value) {
      throw new Error(
        'CLOUD_API_BASE_URL is required for Edge cloud push worker',
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
        'EDGE_API_KEY or DEV_EDGE_API_KEY is required for Edge cloud push worker',
      );
    }

    return value;
  }

  private getIntervalMs() {
    const raw = process.env.EDGE_CLOUD_PUSH_WORKER_INTERVAL_MS;
    const parsed = raw ? Number(raw) : 10_000;

    if (!Number.isFinite(parsed) || parsed < 1_000) {
      return 10_000;
    }

    return Math.floor(parsed);
  }

  private getPushLimit() {
    const raw = process.env.EDGE_CLOUD_PUSH_LIMIT;
    const parsed = raw ? Number(raw) : 20;

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 20;
    }

    return Math.min(Math.floor(parsed), 100);
  }

  private getBootstrapLimit() {
    const raw = process.env.EDGE_CLOUD_PUSH_BOOTSTRAP_LIMIT;
    const parsed = raw ? Number(raw) : 100;

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 100;
    }

    return Math.min(Math.floor(parsed), 500);
  }

  private getRetryDelayMs(retryCount: number) {
    const baseMs = 10_000;
    const maxMs = 5 * 60_000;
    const next = baseMs * Math.max(1, retryCount);

    return Math.min(next, maxMs);
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}