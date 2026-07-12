import { Injectable } from '@nestjs/common';
import { SpaceStatus } from '@parking/db';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisPublisher } from '../../../common/redis/redis.publisher';
import { OccupancyLinkService } from './occupancy-link.service';

@Injectable()
export class OccupancyEventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisPublisher,
    private readonly occupancyLink: OccupancyLinkService,
  ) {}

  async handleParkingSensorStatus(devEui: string, parkingStatus: number) {
    const normalizedDevEui = devEui.toLowerCase();

    const sensorDevice = await this.prisma.sensorDevice.findUnique({
      where: {
        devEui: normalizedDevEui,
      },
      include: {
        parkingSpace: true,
      },
    });

    if (!sensorDevice?.parkingSpaceId) {
      return {
        ok: true,
        ignored: true,
        reason: 'no_parking_space_link',
        devEui: normalizedDevEui,
      };
    }

    const occupied = parkingStatus === 1 || parkingStatus === 3;

    await this.prisma.parkingSpace.update({
      where: {
        id: sensorDevice.parkingSpaceId,
      },
      data: {
        status: occupied ? SpaceStatus.OCCUPIED : SpaceStatus.EMPTY,
      },
    });

const sessionResult =
  await this.occupancyLink.handleOccupancyChanged(
    sensorDevice.id,
    occupied,
  );

    return {
      ok: true,
      occupied,
      parkingSpaceId: sensorDevice.parkingSpaceId,
      status: occupied ? SpaceStatus.OCCUPIED : SpaceStatus.EMPTY,
      sessionResult,
    };
  }
}