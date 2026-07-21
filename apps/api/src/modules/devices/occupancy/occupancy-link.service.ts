import { Injectable } from '@nestjs/common';
import { Prisma, SessionStatus, SpaceStatus } from '@parking/db';
import { PrismaService } from '../../../prisma/prisma.service';
import { InvoicesService } from '../../invoices/invoices.service';
import {
  enqueueEdgeParkingSessionSync,
  enqueueEdgeUnpaidExitSync,
} from '../../../common/sync/edge-parking-session-sync';

@Injectable()
export class OccupancyLinkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
  ) {}

  private generateSessionNo() {
    return `SNS-${Date.now()}`;
  }

  async getLinkedSpaceByDevEui(devEui: string) {
    return this.prisma.sensorDevice.findUnique({
      where: { devEui: devEui.trim().replace(/[\s:-]/g, '').toUpperCase() },
      include: {
        parkingSpace: {
          include: {
            section: {
              include: {
                parkingLot: true,
              },
            },
          },
        },
      },
    });
  }

  async handleOccupancyChanged(sensorDeviceId: string, occupied: boolean) {
    const device = await this.prisma.sensorDevice.findUnique({
      where: { id: sensorDeviceId },
      include: {
        parkingSpace: true,
      },
    });

    if (!device?.parkingSpaceId) {
      return {
        ok: true,
        ignored: true,
        reason: 'no_parking_space_link',
      };
    }

    const parkingSpaceId = device.parkingSpaceId;

    /**
     * Rule:
     * - Only one ACTIVE session is allowed per parking space.
     * - A new session is created only when a new occupied event arrives and
     *   there is no ACTIVE session for that space.
     * - Exit closes the ACTIVE session and moves it out of the current list.
     */
    const activeSession = await this.prisma.parkingSession.findFirst({
      where: {
        parkingSpaceId,
        status: SessionStatus.ACTIVE,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    /**
     * =========================
     * ENTRY: EMPTY -> OCCUPIED
     * =========================
     */
    if (occupied) {
      if (activeSession) {
        await this.prisma.parkingSpace.update({
          where: { id: parkingSpaceId },
          data: { status: SpaceStatus.OCCUPIED },
        });

        return {
          ok: true,
          ignored: true,
          reason: 'already_active',
          session: activeSession,
        };
      }

      const created = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const session = await tx.parkingSession.create({
            data: {
              sessionNo: this.generateSessionNo(),
              parkingSpaceId,
              status: SessionStatus.ACTIVE,
              entryTime: new Date(),
              metadata: {
                registrationStatus: 'UNREGISTERED',
                createdBy: 'sensor',
                sensorDeviceId,
                devEui: device.devEui,
              } as any,
            },
          });

          await tx.parkingSessionEvent.create({
            data: {
              sessionId: session.id,
              type: 'vehicle.entered.by.sensor',
              source: 'sensor',
              payload: {
                sensorDeviceId,
                devEui: device.devEui,
                parkingSpaceId,
              } as any,
            },
          });

          await tx.parkingSpace.update({
            where: { id: parkingSpaceId },
            data: { status: SpaceStatus.OCCUPIED },
          });

          return session;
        },
      );

      await enqueueEdgeParkingSessionSync(
        this.prisma,
        {
          eventType:
            'PARKING_SESSION_ENTERED_FROM_EDGE',
          session: created,
          source:
            'OCCUPANCY_LINK',
          sensorDeviceId,
          devEui:
            device.devEui,
        },
      );

      return {
        ok: true,
        action: 'entry-recorded',
        session: created,
      };
    }

    /**
     * =========================
     * EXIT: OCCUPIED -> EMPTY
     * =========================
     */
    if (!activeSession) {
      await this.prisma.parkingSpace.update({
        where: { id: parkingSpaceId },
        data: { status: SpaceStatus.EMPTY },
      });

      return {
        ok: true,
        ignored: true,
        reason: 'no_active_session',
      };
    }

    const exitTime = new Date();
    const entryTime = activeSession.entryTime ?? activeSession.createdAt;

    const totalMinutes = Math.max(
      1,
      Math.ceil((exitTime.getTime() - entryTime.getTime()) / 1000 / 60),
    );

    const updated = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const session = await tx.parkingSession.update({
          where: { id: activeSession.id },
          data: {
            status: SessionStatus.CLOSED,
            exitSource: 'SENSOR',
            exitTime,
            billingClosedAt: exitTime,
            totalMinutes,
          },
        });

        await tx.parkingSessionEvent.create({
          data: {
            sessionId: session.id,
            type: 'vehicle.exited.by.sensor',
            source: 'sensor',
            payload: {
              sensorDeviceId,
              devEui: device.devEui,
              parkingSpaceId,
              totalMinutes,
            } as any,
          },
        });

        await tx.parkingSpace.update({
          where: { id: parkingSpaceId },
          data: { status: SpaceStatus.EMPTY },
        });

        return session;
      },
    );

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

    await enqueueEdgeParkingSessionSync(
      this.prisma,
      {
        eventType:
          'PARKING_SESSION_EXITED_FROM_EDGE',
        session:
          updatedWithBilling,
        invoice,
        calculation,
        source:
          'OCCUPANCY_LINK',
        sensorDeviceId,
        devEui:
          device.devEui,
      },
    );

    if (invoice.unpaidAmount > 0) {
      await enqueueEdgeUnpaidExitSync(
        this.prisma,
        {
          session:
            updatedWithBilling,
          invoice,
          calculation,
          additionalFeeAmount,
          additionalFeeReason,
          source:
            'OCCUPANCY_LINK',
          sensorDeviceId,
          devEui:
            device.devEui,
        },
      );
    }

    return {
      ok: true,
      action: 'exit-recorded',
      session: updatedWithBilling,
      invoice,
      calculation,
    };
  }
}