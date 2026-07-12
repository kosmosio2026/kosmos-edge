import Redis from 'ioredis';
import { DeviceStatus, EventPublishStatus, Prisma } from '@prisma/client';
import { prisma } from '@parking/db';

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

export async function processSensorStream() {
  const response = await redis.xread(
    'COUNT',
    20,
    'BLOCK',
    1000,
    'STREAMS',
    'parking:sensor-stream',
    '$',
  );

  if (!response) return;

  for (const [, entries] of response) {
    for (const [id, fields] of entries) {
      const dataField = fields.find(([key]) => key === 'data');
      if (!dataField) continue;

      const body = JSON.parse(dataField[1]) as {
        topic: string;
        received_at: string;
        payload: Record<string, unknown>;
      };

      const devEui =
        typeof body.payload?.devEui === 'string'
          ? body.payload.devEui
          : typeof body.payload?.deviceInfo === 'object' &&
              body.payload.deviceInfo &&
              'devEui' in body.payload.deviceInfo
            ? String((body.payload.deviceInfo as Record<string, unknown>).devEui)
            : null;

      if (!devEui) continue;

      const device = await prisma.sensorDevice.findUnique({
        where: { devEui },
      });

      if (!device) continue;

      await prisma.$transaction(async (tx) => {
        await tx.sensorEvent.create({
          data: {
            sensorDeviceId: device.id,
            eventType: 'mqtt.ingested',
            payload: body.payload as Prisma.InputJsonValue,
            publishStatus: EventPublishStatus.NEW,
          },
        });

        await tx.sensorDevice.update({
          where: { id: device.id },
          data: {
            lastSeenAt: new Date(),
            status: DeviceStatus.ACTIVE,
          },
        });
      });

      await redis.xdel('parking:sensor-stream', id);
    }
  }
}