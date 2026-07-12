import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisPublisher } from '../common/redis/redis.publisher';
import { SessionStatus } from '@parking/db';

@Injectable()
export class SensorSyncWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SensorSyncWorker.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisPublisher,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.sync();
    }, 5000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async sync() {
    const states = await this.prisma.$queryRaw<
      { dev_eui: string; parking_status: number }[]
    >`
      SELECT dev_eui, parking_status
      FROM parking_state
    `;

    for (const row of states) {
      const mapping = await this.prisma.sensorDevice.findUnique({
        where: { devEui: row.dev_eui },
        select: {
          parkingSpaceId: true,
        },
      });

      if (!mapping?.parkingSpaceId) continue;

      const active = await this.prisma.parkingSession.findFirst({
        where: {
          parkingSpaceId: mapping.parkingSpaceId,
          status: SessionStatus.ACTIVE,
        },
        orderBy: {
          entryTime: 'desc',
        },
      });

      const occupied = row.parking_status === 1;

      if (occupied && !active) {
        const session = await this.prisma.parkingSession.create({
          data: {
            sessionNo: `S-${Date.now()}`,
            parkingSpaceId: mapping.parkingSpaceId,
            status: SessionStatus.ACTIVE,
            entryTime: new Date(),
            isRegistered: false,
          },
        });

        await this.redis.publish('parking.entry', {
          sessionId: session.id,
          parkingSpaceId: session.parkingSpaceId,
          status: session.status,
        });

        this.logger.log(`Entry detected for ${mapping.parkingSpaceId}`);
      }

      if (!occupied && active) {
        const updated = await this.prisma.parkingSession.update({
          where: { id: active.id },
          data: {
            status: SessionStatus.CLOSED,
            exitTime: new Date(),
          },
        });

        await this.redis.publish('parking.exit', {
          sessionId: updated.id,
          parkingSpaceId: updated.parkingSpaceId,
          status: updated.status,
        });

        this.logger.log(`Exit detected for ${mapping.parkingSpaceId}`);
      }
    }
  }
}