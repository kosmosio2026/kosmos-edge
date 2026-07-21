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
import {
  enqueueEdgeParkingSessionSync,
  enqueueEdgeUnpaidExitSync,
} from '../../common/sync/edge-parking-session-sync';

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

    const session =
      await this.prisma.$transaction(
        async (tx) => {
          const created =
            await tx.parkingSession.create({
              data: {
                sessionNo:
                  `S-${Date.now()}`,
                parkingSpaceId:
                  input.parkingSpaceId,
                plateNumber:
                  input.plateNumber ??
                  null,
                userId:
                  input.userId ?? null,
                status:
                  SessionStatus.ACTIVE,
                entryTime:
                  new Date(),
                entrySource:
                  'SENSOR',
                isRegistered:
                  false,
              },
              include: {
                ParkingSpace: true,
              },
            });

          await tx.parkingSpace.update({
            where: {
              id:
                input.parkingSpaceId,
            },
            data: {
              status:
                SpaceStatus.OCCUPIED,
            },
          });

          return created;
        },
      );

    await this.redis.publish('parking.entry', {
      sessionId: session.id,
      parkingSpaceId: session.parkingSpaceId,
      plateNumber: session.plateNumber,
      status: session.status,
    });

    await enqueueEdgeParkingSessionSync(
      this.prisma,
      {
        eventType:
          'PARKING_SESSION_ENTERED_FROM_EDGE',
        session,
        source:
          'SESSION_ENGINE',
      },
    );

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

    /**
     * 요금 및 Invoice 계산을 먼저 완료한다.
     *
     * 계산에 실패하면 아직 세션이나 주차면을 변경하지 않았으므로
     * ACTIVE / OCCUPIED 상태가 그대로 보존된다.
     */
    const {
      invoice,
      calculation,
      additionalFeeAmount,
      additionalFeeReason,
      exitGraceMinutes,
      exitGraceDeadline,
    } = await this.invoicesService.ensureAdditionalFeeForGraceExpiredSession({
      sessionId: session.id,
      now: exitTime,
    });

    const nextMetadata = {
      ...((session.metadata as any) ?? {}),
      paymentRequired:
        invoice.unpaidAmount > 0,
      paymentStatus:
        invoice.unpaidAmount <= 0
          ? 'PAID'
          : invoice.paidAmount > 0
            ? 'PARTIALLY_PAID'
            : 'UNPAID',
      exitedUnpaid:
        invoice.unpaidAmount > 0,
      /*
       * Edge에서 산출한 로컬 Invoice.
       * Cloud 공식 Invoice가 회신된 후에도 이 값은 보존한다.
       */
      edgeInvoiceId:
        invoice.id,
      edgeInvoiceNo:
        invoice.invoiceNo,
      edgeInvoiceStatus:
        invoice.status,
      edgeInvoiceAmount:
        invoice.amount,
      edgeInvoicePaidAmount:
        invoice.paidAmount,
      edgeInvoiceUnpaidAmount:
        invoice.unpaidAmount,

      /*
       * 기존 호환 필드.
       * Cloud Invoice 회신 전에는 Edge Invoice를 가리키며,
       * 회신 후에는 Cloud 공식 Invoice 값으로 교체된다.
       */
      invoiceId:
        invoice.id,
      invoiceNo:
        invoice.invoiceNo,
      invoiceStatus:
        invoice.status,
      invoiceAmount:
        invoice.amount,
      invoicePaidAmount:
        invoice.paidAmount,
      invoiceUnpaidAmount:
        invoice.unpaidAmount,
      additionalFeeAmount,
      additionalFeeReason,
      exitGraceMinutes,
      exitGraceDeadline,
      feeCalculation:
        calculation,
    };

    /**
     * 세션 종료, 주차면 상태, Edge 동기화 Outbox는
     * 하나의 트랜잭션에서 함께 저장한다.
     */
    const updatedWithBilling =
      await this.prisma.$transaction(
        async (tx) => {
          const updated =
            await tx.parkingSession.update({
              where: {
                id: session.id,
              },
              data: {
                status:
                  nextSessionStatus,
                exitSource:
                  session.exitSource ??
                  'SENSOR',
                exitTime,
                billingClosedAt,
                totalMinutes,
                amount:
                  invoice.amount,
                paidAmount:
                  invoice.paidAmount,
                unpaidAmount:
                  invoice.unpaidAmount,
                feePolicyId:
                  (calculation as any)
                    .policyId ??
                  null,
                metadata:
                  nextMetadata as any,
              },
            });

          if (updated.parkingSpaceId) {
            await tx.parkingSpace.update({
              where: {
                id:
                  updated.parkingSpaceId,
              },
              data: {
                status:
                  SpaceStatus.EMPTY,
              },
            });
          }

          await enqueueEdgeParkingSessionSync(
            tx,
            {
              eventType:
                'PARKING_SESSION_EXITED_FROM_EDGE',
              session:
                updated,
              invoice,
              calculation,
              source:
                'SESSION_ENGINE',
            },
          );

          if (invoice.unpaidAmount > 0) {
            await enqueueEdgeUnpaidExitSync(
              tx,
              {
                session:
                  updated,
                invoice,
                calculation,
                additionalFeeAmount,
                additionalFeeReason,
                source:
                  'SESSION_ENGINE',
              },
            );
          }

          return updated;
        },
      );

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