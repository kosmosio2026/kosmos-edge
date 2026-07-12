import { SyncStatus } from '@prisma/client';
import { prisma } from '@parking/db';

export async function processOutbox() {
  const events = await prisma.syncOutbox.findMany({
    where: { status: SyncStatus.PENDING },
    take: 20,
    orderBy: { createdAt: 'asc' },
    include: { domainEvent: true },
  });

  for (const item of events) {
    try {
      const target =
        process.env.CLOUD_SYNC_URL ?? 'http://localhost:4300/sync/events';

      const response = await fetch(target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sync-destination': item.destination,
        },
        body: JSON.stringify({
          outboxId: item.id,
          domainEvent: item.domainEvent,
        }),
      });

      if (!response.ok) {
        throw new Error(`Cloud sync failed with status ${response.status}`);
      }

      await prisma.syncOutbox.update({
        where: { id: item.id },
        data: {
          status: SyncStatus.ACKED,
          sentAt: item.sentAt ?? new Date(),
          ackedAt: new Date(),
          lastError: null,
        },
      });
    } catch (error) {
      await prisma.syncOutbox.update({
        where: { id: item.id },
        data: {
          status: SyncStatus.FAILED,
          retryCount: item.retryCount + 1,
          nextRetryAt: new Date(Date.now() + 60_000),
          lastError: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }
}

export async function retryFailedOutbox() {
  await prisma.syncOutbox.updateMany({
    where: {
      status: SyncStatus.FAILED,
      nextRetryAt: { lte: new Date() },
    },
    data: {
      status: SyncStatus.PENDING,
    },
  });
}