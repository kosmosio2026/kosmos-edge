import Redis from 'ioredis';
import { Prisma, SessionStatus } from '@prisma/client';
import { prisma } from '@parking/db';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

export async function sweepUnregisteredViolations() {
  const threshold = new Date(Date.now() - 10 * 60 * 1000);

  const sessions = await prisma.parkingSession.findMany({
    where: {
      status: SessionStatus.ACTIVE,
      entryTime: {
        lte: threshold,
      },
      userId: null,
    },
  });

  for (const session of sessions) {
    const metadata =
      session.metadata && typeof session.metadata === 'object'
        ? (session.metadata as Record<string, unknown>)
        : {};

    if (metadata.enforcementStatus === 'VIOLATION') {
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.parkingSession.update({
        where: { id: session.id },
        data: {
          metadata: {
            ...metadata,
            registrationStatus: 'UNREGISTERED',
            enforcementStatus: 'VIOLATION',
            violationAt: new Date().toISOString(),
          } as Prisma.InputJsonValue,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'PARKING_VIOLATION_DETECTED',
          entity: 'ParkingSession',
          entityId: session.id,
          meta: {
            parkingSpaceId: session.parkingSpaceId,
            entryTime: session.entryTime,
          } as Prisma.InputJsonValue,
        },
      });
    });

    await redis.publish(
      'parking:realtime',
      JSON.stringify({
        event: 'violation.detected',
        payload: {
          sessionId: session.id,
          parkingSpaceId: session.parkingSpaceId,
          entryTime: session.entryTime,
        },
        publishedAt: new Date().toISOString(),
      }),
    );
  }
}