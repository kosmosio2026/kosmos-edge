import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';

type SensorEventInput = {
  devEui: string;
  parkingStatus: string | number | boolean;
  gatewayId?: string;
  rssi?: number;
  snr?: number;
  batteryVoltage?: number;
  occurredAt?: string;
  raw?: Record<string, unknown>;
};

type NormalizedParkingStatus = 'OCCUPIED' | 'EMPTY' | 'UNKNOWN';

type ExitPaymentDecision = {
  paymentRequired: boolean;
  paymentStatus: 'PAID' | 'UNPAID' | 'NOT_REQUIRED';
  exitedUnpaid: boolean;
  paymentReason:
    | 'UNREGISTERED_SESSION'
    | 'PAID_EXIT_WITHIN_GRACE'
    | 'PAID_GRACE_EXPIRED_ADDITIONAL_FEE'
    | 'EXITED_UNPAID'
    | 'ZERO_MINUTES';
};

const ACTIVE_SESSION_STATUSES = ['ACTIVE', 'GRACE_PERIOD', 'CREATED'];

@Injectable()
export class SensorIngestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
  ) {}

  async ingestSensorEvent(edgeNodeId: string, input: SensorEventInput) {
    if (!input.devEui) {
      throw new BadRequestException('devEui is required');
    }

    const normalizedStatus = this.normalizeParkingStatus(input.parkingStatus);

    if (normalizedStatus === 'UNKNOWN') {
      throw new BadRequestException(
        `Unsupported parkingStatus: ${input.parkingStatus}`,
      );
    }

    const occurredAt = input.occurredAt
      ? new Date(input.occurredAt)
      : new Date();

    if (Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException('Invalid occurredAt');
    }

    const sensorDevice = await this.prisma.sensorDevice.findUnique({
      where: {
        devEui: input.devEui,
      },
      include: {
        parkingSpace: true,
      },
    });

    if (!sensorDevice) {
      throw new NotFoundException(
        `SensorDevice not found for devEui: ${input.devEui}`,
      );
    }

    if (!sensorDevice.parkingSpaceId || !sensorDevice.parkingSpace) {
      throw new BadRequestException(
        `SensorDevice is not mapped to a parking space: ${input.devEui}`,
      );
    }

    const sensorEvent = await this.prisma.sensorEvent.create({
      data: {
        sensorDeviceId: sensorDevice.id,
        eventType: `PARKING_${normalizedStatus}`,
        payload: {
          appMode: this.getAppMode(),
          edgeNodeId,
          devEui: input.devEui,
          parkingStatus: input.parkingStatus,
          normalizedStatus,
          gatewayId: input.gatewayId ?? null,
          rssi: input.rssi ?? null,
          snr: input.snr ?? null,
          batteryVoltage: input.batteryVoltage ?? null,
          occurredAt: occurredAt.toISOString(),
          raw: input.raw ?? null,
        } as any,
      },
    });

    await this.prisma.sensorDevice.update({
      where: {
        id: sensorDevice.id,
      },
      data: {
        lastSeenAt: occurredAt,
      },
    });

    if (normalizedStatus === 'OCCUPIED') {
      return this.handleOccupied({
        edgeNodeId,
        sensorEventId: sensorEvent.id,
        sensorDeviceId: sensorDevice.id,
        devEui: input.devEui,
        parkingSpaceId: sensorDevice.parkingSpaceId,
        occurredAt,
      });
    }

    return this.handleEmpty({
      edgeNodeId,
      sensorEventId: sensorEvent.id,
      sensorDeviceId: sensorDevice.id,
      devEui: input.devEui,
      parkingSpaceId: sensorDevice.parkingSpaceId,
      occurredAt,
    });
  }

  private async handleOccupied(input: {
    edgeNodeId: string;
    sensorEventId: string;
    sensorDeviceId: string;
    devEui: string;
    parkingSpaceId: string;
    occurredAt: Date;
  }) {
    const existingSession = await this.prisma.parkingSession.findFirst({
      where: {
        parkingSpaceId: input.parkingSpaceId,
        status: {
          in: ACTIVE_SESSION_STATUSES as any,
        },
      },
      orderBy: {
        entryTime: 'desc',
      },
    });

    await this.prisma.parkingSpace.update({
      where: {
        id: input.parkingSpaceId,
      },
      data: {
        status: 'OCCUPIED',
      },
    });

    if (existingSession) {
      await this.prisma.parkingSessionEvent.create({
        data: {
          sessionId: existingSession.id,
          type: 'SENSOR_OCCUPIED_DUPLICATE',
          source: 'EDGE_SENSOR',
          payload: {
            appMode: this.getAppMode(),
            edgeNodeId: input.edgeNodeId,
            sensorEventId: input.sensorEventId,
            sensorDeviceId: input.sensorDeviceId,
            devEui: input.devEui,
            occurredAt: input.occurredAt.toISOString(),
          } as any,
        },
      });

      return {
        ok: true,
        appMode: this.getAppMode(),
        action: 'UNCHANGED_ALREADY_OCCUPIED',
        parkingSpaceId: input.parkingSpaceId,
        sessionId: existingSession.id,
        sessionNo: existingSession.sessionNo,
        isRegistered: existingSession.isRegistered,
      };
    }

    const sessionNo = this.createSessionNo(input.occurredAt);

    const session = await this.prisma.parkingSession.create({
      data: {
        sessionNo,
        parkingSpaceId: input.parkingSpaceId,
        sessionType: 'HOURLY',
        status: 'CREATED' as any,
        entryTime: input.occurredAt,
        graceStartedAt: input.occurredAt,
        isRegistered: false,
        metadata: {
          appMode: this.getAppMode(),
          source: 'EDGE_SENSOR',
          edgeNodeId: input.edgeNodeId,
          sensorEventId: input.sensorEventId,
          sensorDeviceId: input.sensorDeviceId,
          devEui: input.devEui,
          unregisteredSince: input.occurredAt.toISOString(),
          unregisteredOverdue: false,
          paymentRequired: false,
          paymentStatus: 'ACCRUING',
          exitedUnpaid: false,
          paidBeforeExit: false,
          paymentGraceExpired: false,
          paymentGraceExpiredAt: null,
          additionalFeeRequired: false,
          invoiceCreationMode: this.isCloudMode()
            ? 'CLOUD_IMMEDIATE'
            : 'EDGE_SYNC_REQUIRED',
        } as any,
        events: {
          create: {
            type: 'SENSOR_OCCUPIED',
            source: 'EDGE_SENSOR',
            payload: {
              appMode: this.getAppMode(),
              edgeNodeId: input.edgeNodeId,
              sensorEventId: input.sensorEventId,
              sensorDeviceId: input.sensorDeviceId,
              devEui: input.devEui,
              occurredAt: input.occurredAt.toISOString(),
            } as any,
          },
        },
      },
    });

    await this.createDomainEvent({
      aggregateType: 'ParkingSession',
      aggregateId: session.id,
      eventType: 'PARKING_SESSION_STARTED_BY_SENSOR',
      payload: {
        appMode: this.getAppMode(),
        edgeNodeId: input.edgeNodeId,
        sessionId: session.id,
        sessionNo: session.sessionNo,
        parkingSpaceId: input.parkingSpaceId,
        sensorDeviceId: input.sensorDeviceId,
        devEui: input.devEui,
        occurredAt: input.occurredAt.toISOString(),
      },
      occurredAt: input.occurredAt,
    });

    return {
      ok: true,
      appMode: this.getAppMode(),
      action: 'SESSION_STARTED',
      parkingSpaceId: input.parkingSpaceId,
      sessionId: session.id,
      sessionNo: session.sessionNo,
      isRegistered: session.isRegistered,
    };
  }

  private async handleEmpty(input: {
    edgeNodeId: string;
    sensorEventId: string;
    sensorDeviceId: string;
    devEui: string;
    parkingSpaceId: string;
    occurredAt: Date;
  }) {
    const activeSession = await this.prisma.parkingSession.findFirst({
      where: {
        parkingSpaceId: input.parkingSpaceId,
        status: {
          in: ACTIVE_SESSION_STATUSES as any,
        },
      },
      orderBy: {
        entryTime: 'desc',
      },
    });

    await this.prisma.parkingSpace.update({
      where: {
        id: input.parkingSpaceId,
      },
      data: {
        status: 'EMPTY',
      },
    });

    if (!activeSession) {
      return {
        ok: true,
        appMode: this.getAppMode(),
        action: 'UNCHANGED_ALREADY_EMPTY',
        parkingSpaceId: input.parkingSpaceId,
      };
    }

    const entryTime = activeSession.entryTime ?? activeSession.createdAt;

    const totalMinutes = Math.max(
      0,
      Math.ceil((input.occurredAt.getTime() - entryTime.getTime()) / 60000),
    );

    const previousMetadata = this.asRecord(activeSession.metadata);

    const paymentDecision = this.getExitPaymentDecision({
      isRegistered: activeSession.isRegistered,
      totalMinutes,
      occurredAt: input.occurredAt,
      metadata: previousMetadata,
    });

    const paymentRequired = paymentDecision.paymentRequired;
    const paymentStatus = paymentDecision.paymentStatus;
    const additionalFeeRequired =
      paymentDecision.paymentReason ===
      'PAID_GRACE_EXPIRED_ADDITIONAL_FEE';

    const baseMetadata = {
      ...previousMetadata,
      appMode: this.getAppMode(),
      exitedAt: input.occurredAt.toISOString(),
      totalMinutes,
      paymentRequired,
      paymentStatus,
      exitedUnpaid: paymentDecision.exitedUnpaid,
      paymentReason: paymentDecision.paymentReason,
      additionalFeeRequired,
      invoiceCreationMode: this.isCloudMode()
        ? 'CLOUD_IMMEDIATE'
        : 'EDGE_SYNC_REQUIRED',
      invoiceCreatedAtEdge: false,
      invoiceSyncRequired: paymentRequired && !this.isCloudMode(),
    };

    const nextStatus =
      paymentStatus === 'PAID' && paymentRequired === false
        ? 'PAID'
        : 'CLOSED';

    const eventType = paymentRequired
      ? 'SENSOR_EMPTY_PAYMENT_REQUIRED'
      : paymentStatus === 'PAID'
        ? 'SENSOR_EMPTY_PAYMENT_ALREADY_PAID'
        : 'SENSOR_EMPTY';

    let session = await this.prisma.parkingSession.update({
      where: {
        id: activeSession.id,
      },
      data: {
        status: nextStatus as any,
        exitTime: input.occurredAt,
        totalMinutes,
        metadata: baseMetadata as any,
        events: {
          create: {
            type: eventType,
            source: 'EDGE_SENSOR',
            payload: {
              appMode: this.getAppMode(),
              edgeNodeId: input.edgeNodeId,
              sensorEventId: input.sensorEventId,
              sensorDeviceId: input.sensorDeviceId,
              devEui: input.devEui,
              occurredAt: input.occurredAt.toISOString(),
              totalMinutes,
              isRegistered: activeSession.isRegistered,
              paymentRequired,
              paymentStatus,
              exitedUnpaid: paymentDecision.exitedUnpaid,
              paymentReason: paymentDecision.paymentReason,
              additionalFeeRequired,
              invoiceCreationMode: this.isCloudMode()
                ? 'CLOUD_IMMEDIATE'
                : 'EDGE_SYNC_REQUIRED',
            } as any,
          },
        },
      },
    });

    let invoicePayload: Record<string, unknown> | null = null;
    let invoiceCreationSkippedForEdge = false;

    if (paymentRequired && this.isCloudMode()) {
      try {
        const { invoice, calculation } =
          await this.invoicesService.ensureInvoiceForSession({
            sessionId: session.id,
            now: input.occurredAt,
            forceRecalculate: true,
          });

        const invoiceMetadata = {
          ...baseMetadata,
          invoiceId: invoice.id,
          invoiceNo: invoice.invoiceNo,
          invoiceStatus: invoice.status,
          invoiceAmount: invoice.amount,
          invoicePaidAmount: invoice.paidAmount,
          invoiceUnpaidAmount: invoice.unpaidAmount,
          feeCalculation: calculation,
          invoiceIssuedAt:
            invoice.issuedAt instanceof Date
              ? invoice.issuedAt.toISOString()
              : invoice.issuedAt,
          invoiceEnsuredAt: input.occurredAt.toISOString(),
          invoiceCreatedAtEdge: false,
          invoiceCreatedInCloudMode: true,
          invoiceSyncRequired: false,
        };

        session = await this.prisma.parkingSession.update({
          where: {
            id: session.id,
          },
          data: {
            paidAmount: invoice.paidAmount,
            unpaidAmount: invoice.unpaidAmount,
            metadata: invoiceMetadata as any,
            events: {
              create: {
                type: 'UNPAID_INVOICE_CREATED',
                source: 'INVOICE_SERVICE',
                payload: {
                  appMode: this.getAppMode(),
                  invoiceId: invoice.id,
                  invoiceNo: invoice.invoiceNo,
                  invoiceStatus: invoice.status,
                  invoiceAmount: invoice.amount,
                  invoicePaidAmount: invoice.paidAmount,
                  invoiceUnpaidAmount: invoice.unpaidAmount,
                  paymentRequired,
                  paymentStatus,
                  paymentReason: paymentDecision.paymentReason,
                  additionalFeeRequired,
                  occurredAt: input.occurredAt.toISOString(),
                } as any,
              },
            },
          },
        });

        invoicePayload = {
          invoiceId: invoice.id,
          invoiceNo: invoice.invoiceNo,
          invoiceStatus: invoice.status,
          invoiceAmount: invoice.amount,
          invoicePaidAmount: invoice.paidAmount,
          invoiceUnpaidAmount: invoice.unpaidAmount,
          createdInCloudMode: true,
        };

        await this.createDomainEvent({
          aggregateType: 'Invoice',
          aggregateId: invoice.id,
          eventType: 'INVOICE_CREATED_FOR_EXITED_UNPAID_SESSION',
          payload: {
            appMode: this.getAppMode(),
            sessionId: session.id,
            sessionNo: session.sessionNo,
            parkingSpaceId: input.parkingSpaceId,
            invoiceId: invoice.id,
            invoiceNo: invoice.invoiceNo,
            invoiceStatus: invoice.status,
            invoiceAmount: invoice.amount,
            invoicePaidAmount: invoice.paidAmount,
            invoiceUnpaidAmount: invoice.unpaidAmount,
            paymentReason: paymentDecision.paymentReason,
            additionalFeeRequired,
            occurredAt: input.occurredAt.toISOString(),
          },
          occurredAt: input.occurredAt,
        });
      } catch (error) {
        const failureMessage =
          error instanceof Error ? error.message : String(error);

        await this.prisma.parkingSessionEvent.create({
          data: {
            sessionId: session.id,
            type: 'UNPAID_INVOICE_CREATE_FAILED',
            source: 'INVOICE_SERVICE',
            payload: {
              appMode: this.getAppMode(),
              message: failureMessage,
              occurredAt: input.occurredAt.toISOString(),
            } as any,
          },
        });

        await this.createDomainEvent({
          aggregateType: 'ParkingSession',
          aggregateId: session.id,
          eventType: 'UNPAID_INVOICE_CREATE_FAILED',
          payload: {
            appMode: this.getAppMode(),
            sessionId: session.id,
            sessionNo: session.sessionNo,
            parkingSpaceId: input.parkingSpaceId,
            message: failureMessage,
            occurredAt: input.occurredAt.toISOString(),
          },
          occurredAt: input.occurredAt,
        });
      }
    }

    if (paymentRequired && !this.isCloudMode()) {
      invoiceCreationSkippedForEdge = true;

      await this.prisma.parkingSessionEvent.create({
        data: {
          sessionId: session.id,
          type: 'UNPAID_INVOICE_CREATION_SKIPPED_EDGE_MODE',
          source: 'EDGE_SENSOR',
          payload: {
            appMode: this.getAppMode(),
            edgeNodeId: input.edgeNodeId,
            reason: 'INVOICE_AUTHORITY_IS_CLOUD',
            syncRequired: true,
            occurredAt: input.occurredAt.toISOString(),
          } as any,
        },
      });

      await this.createDomainEvent({
        aggregateType: 'ParkingSession',
        aggregateId: session.id,
        eventType: 'PARKING_SESSION_EXITED_UNPAID_EDGE_SYNC_REQUIRED',
        payload: {
          appMode: this.getAppMode(),
          edgeNodeId: input.edgeNodeId,
          sessionId: session.id,
          sessionNo: session.sessionNo,
          parkingSpaceId: input.parkingSpaceId,
          sensorDeviceId: input.sensorDeviceId,
          devEui: input.devEui,
          occurredAt: input.occurredAt.toISOString(),
          totalMinutes,
          isRegistered: session.isRegistered,
          paymentRequired,
          paymentStatus,
          exitedUnpaid: paymentDecision.exitedUnpaid,
          paymentReason: paymentDecision.paymentReason,
          additionalFeeRequired,
          invoice: null,
          invoiceCreated: false,
          invoiceCreationSkippedForEdge: true,
          syncRequired: true,
        },
        occurredAt: input.occurredAt,
      });
    }

    await this.createDomainEvent({
      aggregateType: 'ParkingSession',
      aggregateId: session.id,
      eventType: paymentRequired
        ? 'PARKING_SESSION_EXITED_UNPAID'
        : 'PARKING_SESSION_CLOSED_BY_SENSOR',
      payload: {
        appMode: this.getAppMode(),
        edgeNodeId: input.edgeNodeId,
        sessionId: session.id,
        sessionNo: session.sessionNo,
        parkingSpaceId: input.parkingSpaceId,
        sensorDeviceId: input.sensorDeviceId,
        devEui: input.devEui,
        occurredAt: input.occurredAt.toISOString(),
        totalMinutes,
        isRegistered: session.isRegistered,
        paymentRequired,
        paymentStatus,
        exitedUnpaid: paymentDecision.exitedUnpaid,
        paymentReason: paymentDecision.paymentReason,
        additionalFeeRequired,
        invoice: invoicePayload,
        invoiceCreated: invoicePayload != null,
        invoiceCreationSkippedForEdge,
        syncRequired: paymentRequired && !this.isCloudMode(),
      },
      occurredAt: input.occurredAt,
    });

    return {
      ok: true,
      appMode: this.getAppMode(),
      action: 'SESSION_CLOSED',
      parkingSpaceId: input.parkingSpaceId,
      sessionId: session.id,
      sessionNo: session.sessionNo,
      totalMinutes,
      isRegistered: session.isRegistered,
      paymentRequired,
      paymentStatus,
      exitedUnpaid: paymentDecision.exitedUnpaid,
      paymentReason: paymentDecision.paymentReason,
      additionalFeeRequired,
      invoice: invoicePayload,
      invoiceCreated: invoicePayload != null,
      invoiceCreationSkippedForEdge,
      syncRequired: paymentRequired && !this.isCloudMode(),
    };
  }

  private getExitPaymentDecision(input: {
    isRegistered: boolean;
    totalMinutes: number;
    occurredAt: Date;
    metadata: Record<string, any>;
  }): ExitPaymentDecision {
    if (!input.isRegistered) {
      return {
        paymentRequired: false,
        paymentStatus: 'NOT_REQUIRED',
        exitedUnpaid: false,
        paymentReason: 'UNREGISTERED_SESSION',
      };
    }

    const wasPaidBeforeExit =
      input.metadata.paymentStatus === 'PAID' &&
      input.metadata.paidBeforeExit === true;

    if (wasPaidBeforeExit) {
      const paidExitGraceUntilRaw = input.metadata.paidExitGraceUntil;
      const paidExitGraceUntil =
        typeof paidExitGraceUntilRaw === 'string'
          ? new Date(paidExitGraceUntilRaw)
          : null;

      const hasValidGraceUntil =
        paidExitGraceUntil != null &&
        !Number.isNaN(paidExitGraceUntil.getTime());

      if (
        hasValidGraceUntil &&
        input.occurredAt.getTime() <= paidExitGraceUntil.getTime()
      ) {
        return {
          paymentRequired: false,
          paymentStatus: 'PAID',
          exitedUnpaid: false,
          paymentReason: 'PAID_EXIT_WITHIN_GRACE',
        };
      }

      return {
        paymentRequired: true,
        paymentStatus: 'UNPAID',
        exitedUnpaid: true,
        paymentReason: 'PAID_GRACE_EXPIRED_ADDITIONAL_FEE',
      };
    }

    const paymentRequired = input.totalMinutes > 0;

    return {
      paymentRequired,
      paymentStatus: paymentRequired ? 'UNPAID' : 'NOT_REQUIRED',
      exitedUnpaid: paymentRequired,
      paymentReason: paymentRequired ? 'EXITED_UNPAID' : 'ZERO_MINUTES',
    };
  }

  private getAppMode() {
    return (process.env.APP_MODE ?? 'cloud').toLowerCase();
  }

  private isCloudMode() {
    return this.getAppMode() === 'cloud';
  }

  private normalizeParkingStatus(
    value: string | number | boolean | null | undefined,
  ): NormalizedParkingStatus {
    if (value === true) return 'OCCUPIED';
    if (value === false) return 'EMPTY';

    if (value == null) {
      return 'UNKNOWN';
    }

    if (typeof value === 'number') {
      if (value === 1) return 'OCCUPIED';
      if (value === 0) return 'EMPTY';
      return 'UNKNOWN';
    }

    const normalized = String(value).trim().toUpperCase();

    if (
      normalized === 'OCCUPIED' ||
      normalized === 'FULL' ||
      normalized === 'PARKED' ||
      normalized === 'TRUE' ||
      normalized === '1'
    ) {
      return 'OCCUPIED';
    }

    if (
      normalized === 'EMPTY' ||
      normalized === 'FREE' ||
      normalized === 'VACANT' ||
      normalized === 'FALSE' ||
      normalized === '0'
    ) {
      return 'EMPTY';
    }

    return 'UNKNOWN';
  }

  private createSessionNo(date: Date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const random = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();

    return `PS-${yyyy}${mm}${dd}-${random}`;
  }

  private asRecord(value: unknown): Record<string, any> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, any>;
  }

  private async createDomainEvent(input: {
    aggregateType: string;
    aggregateId: string;
    eventType: string;
    payload: Record<string, unknown>;
    occurredAt: Date;
  }) {
    return this.prisma.domainEvent.create({
      data: {
        eventId: randomUUID(),
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        payload: input.payload as any,
        occurredAt: input.occurredAt,
      },
    });
  }
}