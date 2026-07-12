import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SessionStatus } from '@parking/db';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimePublisherService } from '../realtime/realtime-publisher.service';
import { WsEvents } from '@parking/shared';

@Injectable()
export class EnforcementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimePublisher: RealtimePublisherService,
  ) {}

  async listViolations() {
    const sessions = await this.prisma.parkingSession.findMany({
      where: {
        status: SessionStatus.ACTIVE,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        vehicle: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        ParkingSpace: {
          include: {
            section: {
              include: {
                parkingLot: true,
              },
            },
          },
        },
      },
      take: 200,
    });

    return sessions
      .map((session) => {
        const metadata =
          session.metadata && typeof session.metadata === 'object'
            ? (session.metadata as Record<string, unknown>)
            : {};

        const isViolation = metadata.enforcementStatus === 'VIOLATION';

        return {
          ...session,
          enforcementStatus: metadata.enforcementStatus ?? null,
          violationAt: metadata.violationAt ?? null,
          isViolation,
        };
      })
      .filter((item) => item.isViolation);
  }


  async listUnregisteredOverstay() {
    const threshold = new Date(Date.now() - 10 * 60 * 1000);

    const sessions = await this.prisma.parkingSession.findMany({
      where: {
        status: SessionStatus.ACTIVE,
        entryTime: {
          lte: threshold,
        },
        isRegistered: false,
      },
      orderBy: {
        entryTime: 'asc',
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
          },
        },
        vehicle: true,
        invoice: true,
        ParkingSpace: {
          include: {
            section: {
              include: {
                parkingLot: true,
              },
            },
          },
        },
        feePolicy: true,
      },
      take: 200,
    });

    return {
      ok: true,
      threshold,
      count: sessions.length,
      items: sessions.map((session) => {
        const metadata =
          session.metadata && typeof session.metadata === 'object'
            ? (session.metadata as Record<string, unknown>)
            : {};

        const entryTime = session.entryTime;
        const elapsedMinutes = entryTime
          ? Math.floor((Date.now() - new Date(entryTime).getTime()) / 60000)
          : null;

        return {
          id: session.id,
          sessionNo: session.sessionNo,
          status: session.status,
          entryTime: session.entryTime,
          exitTime: session.exitTime,
          elapsedMinutes,
          isRegistered: session.isRegistered,
          plateNumber:
            session.vehicle?.plateNumber ??
            session.plateNumber ??
            null,
          contactNumber:
            session.user?.phone ??
            (metadata.contactNumber as string | undefined) ??
            (metadata.contact as string | undefined) ??
            null,
          amount: session.amount,
          paidAmount: session.paidAmount,
          unpaidAmount: session.unpaidAmount,
          unpaidFee:
            session.invoice?.unpaidAmount ??
            session.unpaidAmount ??
            0,
          user: session.user,
          vehicle: session.vehicle,
          ParkingSpace: session.ParkingSpace
            ? {
                id: session.ParkingSpace.id,
                code: session.ParkingSpace.code,
                status: session.ParkingSpace.status,
                section: session.ParkingSpace.section
                  ? {
                      id: session.ParkingSpace.section.id,
                      name: session.ParkingSpace.section.name,
                      parkingLot: session.ParkingSpace.section.parkingLot
                        ? {
                            id: session.ParkingSpace.section.parkingLot.id,
                            name: session.ParkingSpace.section.parkingLot.name,
                            code: session.ParkingSpace.section.parkingLot.code,
                          }
                        : null,
                    }
                  : null,
              }
            : null,
          feePolicy: session.feePolicy
            ? {
                id: session.feePolicy.id,
                name: session.feePolicy.name,
              }
            : null,
          enforcementStatus: metadata.enforcementStatus ?? 'UNREGISTERED_OVERSTAY',
          violationReason: 'UNREGISTERED_OVER_10_MINUTES',
        };
      }),
    };
  }

  async getViolationSession(sessionId: string) {
    const session = await this.prisma.parkingSession.findUnique({
      where: { id: sessionId },
      include: {
        vehicle: true,
        user: true,
        ParkingSpace: {
          include: {
            section: {
              include: {
                parkingLot: true,
              },
            },
          },
        },
        events: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }

  async resolveViolation(sessionId: string, resolverUserId: string, note?: string) {
    const session = await this.prisma.parkingSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    const metadata =
      session.metadata && typeof session.metadata === 'object'
        ? (session.metadata as Record<string, unknown>)
        : {};

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.parkingSession.update({
        where: { id: sessionId },
        data: {
          metadata: {
            ...metadata,
            enforcementStatus: 'RESOLVED',
            resolvedAt: new Date().toISOString(),
            resolvedBy: resolverUserId,
            resolutionNote: note ?? null,
          } as any,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: resolverUserId,
          action: 'PARKING_VIOLATION_RESOLVED',
          entity: 'ParkingSession',
          entityId: sessionId,
          meta: {
            note: note ?? null,
          } as any,
        },
      });

      return saved;
    });

    await this.realtimePublisher.publish(WsEvents.VIOLATION_RESOLVED, {
      sessionId,
      resolvedBy: resolverUserId,
      note: note ?? null,
    });

    return updated;
  }
}