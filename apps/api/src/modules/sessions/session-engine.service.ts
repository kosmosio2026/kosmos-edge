import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, SessionStatus, SpaceStatus } from '@parking/db';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { RedisPublisher } from '../../common/redis/redis.publisher';
import { FeeEngineService } from '../billing/fee-engine.service';

@Injectable()
export class SessionEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisPublisher,
    private readonly feeEngine: FeeEngineService,
    private readonly invoicesService: InvoicesService,
  ) {}

  async entry(input: {
    parkingSpaceId: string;
    plateNumber?: string | null;
    userId?: string | null;
  }) {
    const existing = await this.prisma.parkingSession.findFirst({
      where: {
        parkingSpaceId: input.parkingSpaceId,
        status: SessionStatus.ACTIVE,
      },
      orderBy: {
        entryTime: 'desc',
      },
    });

    if (existing) {
      throw new BadRequestException('Active session already exists');
    }

    const session = await this.prisma.parkingSession.create({
      data: {
        sessionNo: `S-${Date.now()}`,
        parkingSpaceId: input.parkingSpaceId,
        plateNumber: input.plateNumber ?? null,
        userId: input.userId ?? null,
        status: SessionStatus.ACTIVE,
        entryTime: new Date(),
        isRegistered: false,
      },
      include: {
        ParkingSpace: true,
      },
    });

    await this.redis.publish('parking.entry', {
      sessionId: session.id,
      parkingSpaceId: session.parkingSpaceId,
      plateNumber: session.plateNumber,
      status: session.status,
    });

    return session;
  }

  async register(sessionId: string, userId: string) {
    const session = await this.prisma.parkingSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.status !== SessionStatus.ACTIVE) {
      throw new BadRequestException('Session is not active');
    }

    if (session.isRegistered) {
      throw new BadRequestException('Session already registered');
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

    const invoice = await this.createInvoice(updated.id);

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

  async exit(sessionId: string) {
    const session = await this.prisma.parkingSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const exitAllowedStatuses: SessionStatus[] = [
      SessionStatus.ACTIVE,
      SessionStatus.GRACE_PERIOD,
      SessionStatus.PAID,
    ];

    if (!exitAllowedStatuses.includes(session.status)) {
      throw new BadRequestException('Session is not active or paid');
    }

    const exitTime = session.exitTime ?? new Date();
    const billingClosedAt = session.billingClosedAt ?? exitTime;
    const nextSessionStatus =
      session.status === SessionStatus.PAID
        ? SessionStatus.PAID
        : SessionStatus.CLOSED;
    const entryTime = session.entryTime ?? session.createdAt;

    const totalMinutes = Math.max(
      1,
      Math.ceil((exitTime.getTime() - entryTime.getTime()) / 1000 / 60),
    );

    const updated = await this.prisma.parkingSession.update({
      where: { id: session.id },
      data: {
        status: nextSessionStatus,
        exitTime,
        billingClosedAt,
        totalMinutes,
      },
    });

    const {
      invoice,
      calculation,
      additionalFeeAmount,
      additionalFeeReason,
      exitGraceMinutes,
      exitGraceDeadline,
    } = await this.invoicesService.ensureAdditionalFeeForGraceExpiredSession({
      sessionId: updated.id,
      now: exitTime,
    });

    const updatedWithBilling = await this.prisma.parkingSession.update({
      where: { id: updated.id },
      data: {
        amount: invoice.amount,
        paidAmount: invoice.paidAmount,
        unpaidAmount: invoice.unpaidAmount,
        feePolicyId: (calculation as any).policyId ?? null,
        metadata: {
          ...((updated.metadata as any) ?? {}),
          paymentRequired: invoice.unpaidAmount > 0,
          paymentStatus:
            invoice.unpaidAmount <= 0
              ? 'PAID'
              : invoice.paidAmount > 0
                ? 'PARTIALLY_PAID'
                : 'UNPAID',
          exitedUnpaid: invoice.unpaidAmount > 0,
          invoiceId: invoice.id,
          invoiceNo: invoice.invoiceNo,
          invoiceStatus: invoice.status,
          invoiceAmount: invoice.amount,
          invoicePaidAmount: invoice.paidAmount,
          invoiceUnpaidAmount: invoice.unpaidAmount,
          additionalFeeAmount,
          additionalFeeReason,
          exitGraceMinutes,
          exitGraceDeadline,
          feeCalculation: calculation,
        } as any,
      },
    });

    if (updatedWithBilling.parkingSpaceId) {
      await this.prisma.parkingSpace.update({
        where: {
          id: updatedWithBilling.parkingSpaceId,
        },
        data: {
          status: SpaceStatus.EMPTY,
        },
      });
    }

    await this.redis.publish('parking.exit', {
      sessionId: updatedWithBilling.id,
      parkingSpaceId: updatedWithBilling.parkingSpaceId,
      status: updatedWithBilling.status,
      amount: updatedWithBilling.amount,
      paidAmount: updatedWithBilling.paidAmount,
      unpaidAmount: updatedWithBilling.unpaidAmount,
      paymentRequired: invoice.unpaidAmount > 0,
      additionalFeeAmount,
      additionalFeeReason,
    });

    return {
      ok: true,
      action: 'exit-recorded',
      session: updatedWithBilling,
      invoice,
      calculation,
      additionalFeeAmount,
      additionalFeeReason,
      exitGraceMinutes,
      exitGraceDeadline,
    };
  }

  async exitBySpace(parkingSpaceId: string) {
    const session = await this.prisma.parkingSession.findFirst({
      where: {
        parkingSpaceId,
        status: {
          in: [
            SessionStatus.ACTIVE,
            SessionStatus.GRACE_PERIOD,
            SessionStatus.PAID,
          ],
        },
      },
      orderBy: {
        entryTime: 'desc',
      },
    });

    if (!session) {
      throw new NotFoundException('Active session not found');
    }

    return this.exit(session.id);
  }

  async createInvoice(sessionId: string) {
    const session = await this.prisma.parkingSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        entryTime: true,
      },
    });

    if (!session || !session.entryTime) {
      throw new NotFoundException('Session not found');
    }

    const amount = await this.feeEngine.calculate(sessionId);

    return this.prisma.invoice.create({
      data: {
        invoiceNo: `INV-${Date.now()}`,
        sessionId: session.id,
        amount,
        status: InvoiceStatus.ISSUED,
      },
    });
  }

  calculateAmount(
    totalMinutes: number,
    feePolicy:
      | {
          baseMinutes: number;
          baseFee: number;
          unitMinutes: number;
          unitFee: number;
          dailyMax: number | null;
        }
      | null,
  ) {
    if (!feePolicy) return 0;

    if (totalMinutes <= feePolicy.baseMinutes) {
      return feePolicy.baseFee;
    }

    const extraMinutes = totalMinutes - feePolicy.baseMinutes;
    const units = Math.ceil(extraMinutes / feePolicy.unitMinutes);

    let amount = feePolicy.baseFee + units * feePolicy.unitFee;

    if (feePolicy.dailyMax) {
      amount = Math.min(amount, feePolicy.dailyMax);
    }

    return amount;
  }
}