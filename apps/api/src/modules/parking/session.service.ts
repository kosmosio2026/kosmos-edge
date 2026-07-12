import { Injectable } from '@nestjs/common';
import { SessionStatus } from '@parking/db';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  async createSensorSession(parkingSpaceId: string) {
    const active = await this.prisma.parkingSession.findFirst({
      where: {
        parkingSpaceId,
        status: SessionStatus.ACTIVE,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (active) return active;

    return this.prisma.parkingSession.create({
      data: {
        sessionNo: `SES-${Date.now()}`,
        parkingSpaceId,
        status: SessionStatus.ACTIVE,
        entryTime: new Date(),
        metadata: {
          createdBy: 'legacy-parking-session-service',
        } as any,
      },
    });
  }

  async closeSession(sessionId: string) {
    const session = await this.prisma.parkingSession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.CLOSED,
        exitTime: new Date(),
      },
    });

    await this.billing.createInvoice(sessionId);

    return session;
  }
}