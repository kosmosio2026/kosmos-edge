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
export class ViolationWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ViolationWorker.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisPublisher,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.checkUnregisteredViolations();
    }, 30_000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async checkUnregisteredViolations() {
    const now = Date.now();

    const sessions = await this.prisma.parkingSession.findMany({
      where: {
        status: SessionStatus.ACTIVE,
        isRegistered: false,
      },
    });

    for (const session of sessions) {
      if (!session.entryTime) continue;

      const minutes =
        (now - new Date(session.entryTime).getTime()) / 60000;

      if (minutes <= 10) continue;

      const updated = await this.prisma.parkingSession.update({
        where: { id: session.id },
        data: {
          status: SessionStatus.LOST,
        },
      });

      await this.redis.publish('parking.violation', {
        sessionId: updated.id,
        parkingSpaceId: updated.parkingSpaceId,
        status: updated.status,
        occupancyState: 'VIOLATION',
      });

      this.logger.warn(
        `Violation detected for session ${updated.id} / space ${updated.parkingSpaceId}`,
      );
    }
  }
}