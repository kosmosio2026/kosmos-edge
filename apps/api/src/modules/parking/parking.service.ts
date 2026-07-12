import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, SessionStatus } from '@parking/db';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisPublisher } from '../../common/redis/redis.publisher';
import { FeeEngineService } from '../billing/fee-engine.service';

@Injectable()
export class ParkingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisPublisher,
    private readonly feeEngine: FeeEngineService,
  ) {}

  async getActiveSessionBySpace(spaceId: string) {
  const session = await this.prisma.parkingSession.findFirst({
    where: {
      parkingSpaceId: spaceId,
      status: SessionStatus.ACTIVE,
    },
    orderBy: {
      entryTime: 'desc',
    },
  });

  if (!session) {
    throw new NotFoundException('Active session not found');
  }

  return session;
}

  async register(spaceId: string, userId: string) {
    const blocked = await this.prisma.userBlacklist.findFirst({
      where: {
        userId,
        isActive: true,
      },
      select: {
        id: true,
        reason: true,
      },
    });

    if (blocked) {
      throw new BadRequestException(
        `User is blacklisted: ${blocked.reason}`,
      );
    }

    const session = await this.prisma.parkingSession.findFirst({
      where: {
        parkingSpaceId: spaceId,
        status: SessionStatus.ACTIVE,
      },
      orderBy: {
        entryTime: 'desc',
      },
    });

    if (!session) {
      throw new NotFoundException('No active session');
    }

    if (session.isRegistered) {
      throw new BadRequestException('Already registered');
    }

    const updated = await this.prisma.parkingSession.update({
      where: { id: session.id },
      data: {
        isRegistered: true,
        registeredAt: new Date(),
        userId,
      },
    });

    await this.redis.publish('parking.register', {
      sessionId: updated.id,
      parkingSpaceId: updated.parkingSpaceId,
      status: updated.status,
      occupancyState: 'OCCUPIED_REGISTERED',
    });

    const invoice = await this.createBilling(updated.id);

if (!invoice) {
  throw new Error('Failed to create invoice');
}

await this.redis.publish('billing.created', {
  sessionId: updated.id,
  invoiceId: invoice.id,
  amount: invoice.amount,
});

    return {
      session: updated,
      invoice,
    };
  }

  async createBilling(sessionId: string) {
    const session = await this.prisma.parkingSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        entryTime: true,
      },
    });

  if (!session || !session.entryTime) return;

  const minutes =
    (Date.now() - new Date(session.entryTime).getTime()) / 60000;

  const amount = await this.feeEngine.calculate(sessionId);

  return this.prisma.invoice.create({
  data: {
    invoiceNo: `INV-${Date.now()}`,
    sessionId,
    amount,
    status: 'ISSUED',
  },
});
}
}