import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { FeePolicyService } from '../fees/fee-policy.service';
import type { AuthUser } from '../../common/types/auth-user.type';

type ParkingMapSpaceState =
  | 'EMPTY'
  | 'OCCUPIED_REGISTERED'
  | 'OCCUPIED_UNREGISTERED'
  | 'UNREGISTERED_OVERDUE'
  | 'PAYMENT_GRACE_EXPIRED'
  | 'LONG_PARKING_ALERT'
  | 'EXITED_UNPAID'
  | 'DISABLED'
  | 'SENSOR_ERROR'
  | 'UNKNOWN';

const ACTIVE_SESSION_STATUSES = ['ACTIVE', 'GRACE_PERIOD', 'CREATED'];

function getUserRoles(user?: AuthUser | null): string[] {
  const raw = (user as any)?.roles ?? (user as any)?.role ?? [];
  if (Array.isArray(raw)) return raw.map(String);
  if (raw) return [String(raw)];
  return [];
}

function isAdmin(user?: AuthUser | null) {
  return getUserRoles(user).includes('ADMIN');
}

function isManager(user?: AuthUser | null) {
  return getUserRoles(user).includes('MANAGER');
}

function isOperator(user?: AuthUser | null) {
  return getUserRoles(user).includes('OPERATOR');
}

@Injectable()
export class ParkingMonitorService {

  private readonly logger = new Logger(ParkingMonitorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly feePolicyService: FeePolicyService,
  ) {}

  private async getManagerParkingLotIds(userId: string) {
    const rows = await this.prisma.managerParkingLot.findMany({
      where: {
        managerProfileUserId: userId,
      },
      select: {
        parkingLotId: true,
      },
    });

    return rows.map((row) => row.parkingLotId);
  }

  private async getOperatorParkingSectionIds(userId: string) {
    const rows = await this.prisma.operatorParkingSection.findMany({
      where: {
        operatorProfileUserId: userId,
      },
      select: {
        sectionId: true,
      },
    });

    return rows.map((row) => row.sectionId);
  }

  private async getLiveSpaceScope(user?: AuthUser) {
    if (!user?.sub || isAdmin(user)) {
      return null;
    }

    if (isManager(user)) {
      return {
        parkingLotIds: await this.getManagerParkingLotIds(user.sub),
        sectionIds: null as string[] | null,
      };
    }

    if (isOperator(user)) {
      return {
        parkingLotIds: null as string[] | null,
        sectionIds: await this.getOperatorParkingSectionIds(user.sub),
      };
    }

    return null;
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async scanUnregisteredOverdueSessions() {
    const unregisteredResult = await this.markUnregisteredOverdueSessions();
    const paymentGraceResult = await this.markPaymentGraceExpiredSessions();
    const longParkingResult = await this.markLongParkingAlertSessions();

    if (unregisteredResult.marked > 0) {
      this.logger.warn(
        `Marked ${unregisteredResult.marked} unregistered overdue parking sessions`,
      );
    }

    if (paymentGraceResult.marked > 0) {
      this.logger.warn(
        `Marked ${paymentGraceResult.marked} payment grace expired parking sessions`,
      );
    }

    if (longParkingResult.marked > 0) {
      this.logger.warn(
        `Marked ${longParkingResult.marked} long parking alert sessions`,
      );
    }
  }

  async markUnregisteredOverdueSessions() {
    const now = new Date();
    const thresholdMinutes = this.getUnregisteredOverdueMinutes();
    const cutoff = new Date(now.getTime() - thresholdMinutes * 60 * 1000);

    const sessions = await this.prisma.parkingSession.findMany({
      where: {
        status: {
          in: ACTIVE_SESSION_STATUSES as any,
        },
        isRegistered: false,
        entryTime: {
          lte: cutoff,
        },
      },
      include: {
        ParkingSpace: {
          include: {
            section: {
              include: {
                parkingLot: true,
              },
            },
          },
        },
      } as any,
      orderBy: {
        entryTime: 'asc',
      },
      take: 200,
    });

    let marked = 0;

    for (const session of sessions as any[]) {
      const metadata = this.asRecord(session.metadata);

      if (metadata.unregisteredOverdue === true) {
        continue;
      }

      const nextMetadata = {
        ...metadata,
        unregisteredOverdue: true,
        unregisteredOverdueAt: now.toISOString(),
        unregisteredOverdueThresholdMinutes: thresholdMinutes,
      };

      await this.prisma.parkingSession.update({
        where: {
          id: session.id,
        },
        data: {
          metadata: nextMetadata as any,
          events: {
            create: {
              type: 'UNREGISTERED_OVERDUE',
              source: 'SYSTEM_MONITOR',
              payload: {
                sessionId: session.id,
                sessionNo: session.sessionNo,
                parkingSpaceId: session.parkingSpaceId,
                entryTime: session.entryTime?.toISOString?.() ?? null,
                detectedAt: now.toISOString(),
                thresholdMinutes,
              } as any,
            },
          },
        },
      } as any);

      await this.createDomainEvent({
        aggregateType: 'ParkingSession',
        aggregateId: session.id,
        eventType: 'PARKING_SESSION_UNREGISTERED_OVERDUE',
        payload: {
          sessionId: session.id,
          sessionNo: session.sessionNo,
          parkingSpaceId: session.parkingSpaceId,
          parkingSpaceCode: session.ParkingSpace?.code ?? null,
          parkingLotId: session.ParkingSpace?.section?.parkingLotId ?? null,
          parkingLotName: session.ParkingSpace?.section?.parkingLot?.name ?? null,
          entryTime: session.entryTime?.toISOString?.() ?? null,
          detectedAt: now.toISOString(),
          thresholdMinutes,
        },
        occurredAt: now,
      });

      marked += 1;
    }

    return {
      ok: true,
      marked,
      checked: sessions.length,
      thresholdMinutes,
    };
  }

  async markPaymentGraceExpiredSessions() {
    const now = new Date();

    const sessions = await this.prisma.parkingSession.findMany({
      where: {
        status: {
          in: ACTIVE_SESSION_STATUSES as any,
        },
        isRegistered: true,
      },
      orderBy: {
        entryTime: 'asc',
      },
      take: 200,
    });

    let marked = 0;

    for (const session of sessions as any[]) {
      const metadata = this.asRecord(session.metadata);

      if (metadata.paymentStatus !== 'PAID') continue;
      if (metadata.paidBeforeExit !== true) continue;
      if (metadata.paymentGraceExpired === true) continue;

      const paidExitGraceUntilRaw = metadata.paidExitGraceUntil;
      const paidExitGraceUntil =
        typeof paidExitGraceUntilRaw === 'string'
          ? new Date(paidExitGraceUntilRaw)
          : null;

      if (
        !paidExitGraceUntil ||
        Number.isNaN(paidExitGraceUntil.getTime()) ||
        now.getTime() <= paidExitGraceUntil.getTime()
      ) {
        continue;
      }

      const nextMetadata = {
        ...metadata,
        paymentGraceExpired: true,
        paymentGraceExpiredAt: now.toISOString(),
        additionalFeeRequired: true,
        paymentStatus: 'PAID',
        paymentReason: 'PAID_GRACE_EXPIRED_STILL_OCCUPIED',
      };

      await this.prisma.parkingSession.update({
        where: {
          id: session.id,
        },
        data: {
          metadata: nextMetadata as any,
          events: {
            create: {
              type: 'PAYMENT_GRACE_EXPIRED',
              source: 'SYSTEM_MONITOR',
              payload: {
                sessionId: session.id,
                sessionNo: session.sessionNo,
                parkingSpaceId: session.parkingSpaceId,
                paidExitGraceUntil: paidExitGraceUntil.toISOString(),
                detectedAt: now.toISOString(),
              } as any,
            },
          },
        },
      } as any);

      await this.createDomainEvent({
        aggregateType: 'ParkingSession',
        aggregateId: session.id,
        eventType: 'PARKING_SESSION_PAYMENT_GRACE_EXPIRED',
        payload: {
          sessionId: session.id,
          sessionNo: session.sessionNo,
          parkingSpaceId: session.parkingSpaceId,
          paidExitGraceUntil: paidExitGraceUntil.toISOString(),
          detectedAt: now.toISOString(),
        },
        occurredAt: now,
      });

      marked += 1;
    }

    return {
      ok: true,
      marked,
      checked: sessions.length,
    };
  }

  async markLongParkingAlertSessions() {
    const now = new Date();
    const thresholdHours = this.getLongParkingAlertHours();
    const thresholdMs = thresholdHours * 60 * 60 * 1000;
    const cutoff = new Date(now.getTime() - thresholdMs);

    const sessions = await this.prisma.parkingSession.findMany({
      where: {
        status: {
          in: ACTIVE_SESSION_STATUSES as any,
        },
        entryTime: {
          lte: cutoff,
        },
      },
      include: {
        ParkingSpace: {
          include: {
            section: {
              include: {
                parkingLot: true,
              },
            },
          },
        },
      } as any,
      orderBy: {
        entryTime: 'asc',
      },
      take: 200,
    });

    let marked = 0;

    for (const session of sessions as any[]) {
      const metadata = this.asRecord(session.metadata);

      if (metadata.longParkingAlert === true) {
        continue;
      }

      const nextMetadata = {
        ...metadata,
        longParkingAlert: true,
        longParkingAlertAt: now.toISOString(),
        longParkingAlertThresholdHours: thresholdHours,
      };

      await this.prisma.parkingSession.update({
        where: {
          id: session.id,
        },
        data: {
          metadata: nextMetadata as any,
          events: {
            create: {
              type: 'LONG_PARKING_ALERT',
              source: 'SYSTEM_MONITOR',
              payload: {
                sessionId: session.id,
                sessionNo: session.sessionNo,
                parkingSpaceId: session.parkingSpaceId,
                entryTime: session.entryTime?.toISOString?.() ?? null,
                detectedAt: now.toISOString(),
                thresholdHours,
              } as any,
            },
          },
        },
      } as any);

      await this.createDomainEvent({
        aggregateType: 'ParkingSession',
        aggregateId: session.id,
        eventType: 'PARKING_SESSION_LONG_PARKING_ALERT',
        payload: {
          sessionId: session.id,
          sessionNo: session.sessionNo,
          parkingSpaceId: session.parkingSpaceId,
          parkingSpaceCode: session.ParkingSpace?.code ?? null,
          parkingLotId: session.ParkingSpace?.section?.parkingLotId ?? null,
          parkingLotName: session.ParkingSpace?.section?.parkingLot?.name ?? null,
          entryTime: session.entryTime?.toISOString?.() ?? null,
          detectedAt: now.toISOString(),
          thresholdHours,
        },
        occurredAt: now,
      });

      marked += 1;
    }

    return {
      ok: true,
      marked,
      checked: sessions.length,
      thresholdHours,
    };
  }

  async getLiveSpaceStates(user?: AuthUser) {
    const now = new Date();
    const scope = await this.getLiveSpaceScope(user);

    if (scope?.parkingLotIds && scope.parkingLotIds.length === 0) {
      return {
        ok: true,
        generatedAt: now.toISOString(),
        spaces: [],
      };
    }

    if (scope?.sectionIds && scope.sectionIds.length === 0) {
      return {
        ok: true,
        generatedAt: now.toISOString(),
        spaces: [],
      };
    }

    const spaces = await this.prisma.parkingSpace.findMany({
      where: {
        ...(scope?.parkingLotIds
          ? {
              section: {
                parkingLotId: {
                  in: scope.parkingLotIds,
                },
              },
            }
          : {}),
        ...(scope?.sectionIds
          ? {
              sectionId: {
                in: scope.sectionIds,
              },
            }
          : {}),
      },
      include: {
        section: {
          include: {
            parkingLot: true,
          },
        },
        sensorDevice: true,
      },
      orderBy: [
        {
          sectionId: 'asc',
        },
        {
          code: 'asc',
        },
      ],
    });

    const spaceIds = spaces.map((space) => space.id);

    const activeSessions = await this.prisma.parkingSession.findMany({
      where: {
        parkingSpaceId: {
          in: spaceIds,
        },
        status: {
          in: ACTIVE_SESSION_STATUSES as any,
        },
      },
      orderBy: {
        entryTime: 'desc',
      },
    });

    const unpaidClosedSessions = await this.prisma.parkingSession.findMany({
      where: {
        parkingSpaceId: {
          in: spaceIds,
        },
        status: 'CLOSED' as any,
      },
      orderBy: {
        exitTime: 'desc',
      },
      take: 500,
    });

    const activeSessionBySpaceId = new Map<string, typeof activeSessions[number]>();
    for (const session of activeSessions) {
      if (!session.parkingSpaceId) continue;
      if (!activeSessionBySpaceId.has(session.parkingSpaceId)) {
        activeSessionBySpaceId.set(session.parkingSpaceId, session);
      }
    }

    const unpaidClosedSessionBySpaceId = new Map<
      string,
      typeof unpaidClosedSessions[number]
    >();

    for (const session of unpaidClosedSessions) {
      if (!session.parkingSpaceId) continue;

      const metadata = this.asRecord(session.metadata);
      const unpaidAmount = Number(
        metadata.unpaidAmount ?? metadata.amount ?? metadata.finalAmount ?? 0,
      );

      if (
        (metadata.paymentStatus === 'UNPAID' ||
          metadata.additionalFeeRequired === true ||
          unpaidAmount > 0) &&
        !unpaidClosedSessionBySpaceId.has(session.parkingSpaceId)
      ) {
        unpaidClosedSessionBySpaceId.set(session.parkingSpaceId, session);
      }
    }

    const liveSpaces = await Promise.all(
      spaces.map(async (space) => {
        const spaceAny = space as any;
        const section = spaceAny.section ?? null;
        const parkingLot = section?.parkingLot ?? null;
        const sensor = spaceAny.sensorDevice ?? null;

        const activeSession = activeSessionBySpaceId.get(space.id) ?? null;
        const unpaidClosedSession =
          unpaidClosedSessionBySpaceId.get(space.id) ?? null;

        const activeMetadata = this.asRecord(activeSession?.metadata);
        const unpaidMetadata = this.asRecord(unpaidClosedSession?.metadata);
        const effectiveMetadata = activeSession
          ? activeMetadata
          : unpaidMetadata;

        const accruedFee = activeSession
          ? await this.calculateAccruedFeeForActiveSession({
              activeSession,
              parkingLotId: section?.parkingLotId ?? null,
              calculatedAt: now,
            })
          : null;

        const longParkingAlert =
          activeSession != null &&
          (activeMetadata.longParkingAlert === true ||
            this.isLongParkingByEntryTime(activeSession.entryTime));

        const state = this.resolveSpaceState({
          spaceStatus: space.status,
          isActive: space.isActive,
          activeSession,
          unpaidClosedSession,
          metadata: effectiveMetadata,
          sensorStatus: sensor?.status ?? null,
        });

        const derivedPaymentStatus = activeSession
          ? this.resolveActivePaymentStatus({
              metadata: activeMetadata,
              isRegistered: activeSession.isRegistered,
              accruedFeeAmount: accruedFee?.amount ?? null,
              longParkingAlert,
            })
          : null;

        return {
          parkingLotId: section?.parkingLotId ?? null,
          parkingLotName: parkingLot?.name ?? null,
          sectionId: space.sectionId,
          sectionCode: section?.code ?? null,
          spaceId: space.id,
          spaceCode: space.code,
          spaceNumber: space.number,
          type: space.type,
          lat: space.lat,
          lng: space.lng,
          widthMeter: space.widthMeter ?? 2.5,
          heightMeter: space.heightMeter ?? 5,
          rotationDeg: space.rotationDeg ?? 0,
          polygonJson: space.polygonJson,
          rawSpaceStatus: space.status,
          state,
          color: this.stateToColor(state),
          sensor: sensor
            ? {
                id: sensor.id,
                name: sensor.name,
                devEui: sensor.devEui,
                status: sensor.status,
                lastSeenAt: sensor.lastSeenAt,
              }
            : null,
          activeSession: activeSession
            ? {
                id: activeSession.id,
                sessionNo: activeSession.sessionNo,
                status: activeSession.status,
                entryTime: activeSession.entryTime,
                isRegistered: activeSession.isRegistered,
                registrationStatus: activeSession.registrationStatus,
                registrationMethod: activeSession.registrationMethod,
                plateNumber: activeSession.plateNumber,
                accruedFeeAmount: accruedFee?.amount ?? null,
                accruedFeeCurrency: accruedFee?.currency ?? 'KRW',
                accruedFeeTotalMinutes: accruedFee?.totalMinutes ?? null,
                accruedFeeCalculatedAt: accruedFee?.calculatedAt ?? null,
                accruedFeePolicyId: accruedFee?.policyId ?? null,
                paymentStatus: derivedPaymentStatus,
                longParkingAlert,
                unregisteredOverdue:
                  activeMetadata.unregisteredOverdue === true,
                paymentGraceExpired:
                  activeMetadata.paymentGraceExpired === true,
                additionalFeeRequired:
                  activeMetadata.additionalFeeRequired === true,
                paymentReason: activeMetadata.paymentReason ?? null,
              }
            : null,
          unpaidClosedSession: unpaidClosedSession
            ? {
                id: unpaidClosedSession.id,
                sessionNo: unpaidClosedSession.sessionNo,
                status: unpaidClosedSession.status,
                entryTime: unpaidClosedSession.entryTime,
                exitTime: unpaidClosedSession.exitTime,
                paymentStatus: unpaidMetadata.paymentStatus ?? 'UNPAID',
                additionalFeeRequired:
                  unpaidMetadata.additionalFeeRequired === true,
                paymentReason: unpaidMetadata.paymentReason ?? null,
              }
            : null,
        };
      }),
    );

    return {
      ok: true,
      generatedAt: now.toISOString(),
      spaces: liveSpaces,
    };
  }

  async getLiveSpaceStatesByLot(parkingLotId: string, user?: AuthUser) {
    const scope = await this.getLiveSpaceScope(user);

    if (scope?.parkingLotIds && !scope.parkingLotIds.includes(parkingLotId)) {
      throw new ForbiddenException('No permission to access this parking lot.');
    }

    const all = await this.getLiveSpaceStates(user);
    const spaces = all.spaces.filter(
      (space) => space.parkingLotId === parkingLotId,
    );

    if (scope?.sectionIds && spaces.length === 0) {
      throw new ForbiddenException('No permission to access this parking lot.');
    }

    return {
      ...all,
      spaces,
    };
  }

  private resolveSpaceState(input: {
    spaceStatus: string;
    isActive: boolean;
    activeSession: any | null;
    unpaidClosedSession?: any | null;
    metadata: Record<string, unknown>;
    sensorStatus: string | null;
  }): ParkingMapSpaceState {
    if (!input.isActive || input.spaceStatus === 'DISABLED') {
      return 'DISABLED';
    }

    if (input.sensorStatus === 'ERROR' || input.sensorStatus === 'OFFLINE') {
      return 'SENSOR_ERROR';
    }

    if (input.activeSession) {
      if (input.metadata.paymentGraceExpired === true) {
        return 'PAYMENT_GRACE_EXPIRED';
      }

      if (input.metadata.longParkingAlert === true) {
        return 'LONG_PARKING_ALERT';
      }

      if (input.metadata.unregisteredOverdue === true) {
        return 'UNREGISTERED_OVERDUE';
      }

      if (input.activeSession.isRegistered) {
        return 'OCCUPIED_REGISTERED';
      }

      return 'OCCUPIED_UNREGISTERED';
    }

    if (input.unpaidClosedSession) {
      return 'EXITED_UNPAID';
    }

    if (input.spaceStatus === 'OCCUPIED') {
      return 'OCCUPIED_UNREGISTERED';
    }

    if (input.spaceStatus === 'EMPTY') {
      return 'EMPTY';
    }

    return 'UNKNOWN';
  }

  private stateToColor(state: ParkingMapSpaceState) {
    switch (state) {
      case 'EMPTY':
        return '#22c55e';
      case 'OCCUPIED_REGISTERED':
        return '#3b82f6';
      case 'OCCUPIED_UNREGISTERED':
        return '#f97316';
      case 'UNREGISTERED_OVERDUE':
        return '#ef4444';
      case 'PAYMENT_GRACE_EXPIRED':
        return '#be123c';
      case 'LONG_PARKING_ALERT':
        return '#7c3aed';
      case 'EXITED_UNPAID':
        return '#991b1b';
      case 'DISABLED':
        return '#64748b';
      case 'SENSOR_ERROR':
        return '#facc15';
      default:
        return '#94a3b8';
    }
  }

  private asRecord(value: unknown): Record<string, any> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, any>;
    }

    return {};
  }

  private getUnregisteredOverdueMinutes() {
    return Number(process.env.UNREGISTERED_OVERDUE_MINUTES ?? 10);
  }

  private getLongParkingAlertHours() {
    return Number(process.env.LONG_PARKING_ALERT_HOURS ?? 24);
  }

  private isLongParkingByEntryTime(entryTime: Date | string | null) {
    if (!entryTime) return false;

    const date = entryTime instanceof Date ? entryTime : new Date(entryTime);
    if (Number.isNaN(date.getTime())) return false;

    const thresholdHours = this.getLongParkingAlertHours();
    return Date.now() - date.getTime() >= thresholdHours * 60 * 60 * 1000;
  }

  private resolveActivePaymentStatus(input: {
    metadata: Record<string, any>;
    isRegistered: boolean;
    accruedFeeAmount: number | null;
    longParkingAlert: boolean;
  }) {
    if (input.metadata.paymentStatus) {
      return input.metadata.paymentStatus;
    }

    if (input.metadata.paymentGraceExpired === true) {
      return 'ADDITIONAL_FEE_REQUIRED';
    }

    if (input.longParkingAlert) {
      return 'ACCRUING';
    }

    if (input.accruedFeeAmount === 0) {
      return 'NO_FEE';
    }

    if (input.isRegistered) {
      return 'ACCRUING';
    }

    return 'ACCRUING';
  }

  private async calculateAccruedFeeForActiveSession(input: {
    activeSession: {
      id: string;
      entryTime: Date | string | null;
      isRegistered: boolean;
    };
    parkingLotId: string | null;
    calculatedAt: Date;
  }) {
    if (!input.parkingLotId || !input.activeSession.entryTime) {
      return null;
    }

    const entryTime =
      input.activeSession.entryTime instanceof Date
        ? input.activeSession.entryTime
        : new Date(input.activeSession.entryTime);

    if (Number.isNaN(entryTime.getTime())) {
      return null;
    }

    const totalMinutes = Math.max(
      0,
      Math.ceil(
        (input.calculatedAt.getTime() - entryTime.getTime()) / 60_000,
      ),
    );

    try {
      const calculation = await this.feePolicyService.calculateParkingFee({
        parkingLotId: input.parkingLotId,
        totalMinutes,
        vehicleType: 'GENERAL',
        isMember: false,
        now: input.calculatedAt,
      } as any);

      return {
        amount: (calculation as any).totalAmount ?? 0,
        currency: 'KRW',
        totalMinutes: (calculation as any).totalMinutes ?? totalMinutes,
        calculatedAt: input.calculatedAt.toISOString(),
        policyId: (calculation as any).policyId ?? null,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to calculate accrued fee for active session ${input.activeSession.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      return {
        amount: null,
        currency: 'KRW',
        totalMinutes,
        calculatedAt: input.calculatedAt.toISOString(),
        policyId: null,
      };
    }
  }

  private async createDomainEvent(input: {
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, any>;
    occurredAt: Date;
  }) {
    try {
      await (this.prisma as any).domainEvent.create({
        data: {
          aggregateType: input.aggregateType,
          aggregateId: input.aggregateId,
          eventType: input.eventType,
          payload: input.payload as any,
          occurredAt: input.occurredAt,
        },
      });
    } catch {
      // domain event table may be unavailable in some dev migrations
    }
  }
}
