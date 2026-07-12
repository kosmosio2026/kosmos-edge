import { DeviceStatus } from '@prisma/client';
import { prisma } from '@parking/db';

export async function sweepOfflineDevices() {
  const threshold = new Date(Date.now() - 5 * 60 * 1000);

  await prisma.sensorDevice.updateMany({
    where: {
      lastSeenAt: { lt: threshold },
      status: DeviceStatus.ACTIVE,
    },
    data: {
      status: DeviceStatus.OFFLINE,
    },
  });
}