import { isConnectedEdgeProfile } from '../../../common/config/app-mode';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SpaceStatus } from '@parking/db';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../../prisma/prisma.service';
import { SessionEngineService } from '../../sessions/session-engine.service';

type SensorEventInput = {
  eventType?: string;
  payload?: {
    devEui?: string;
    parkingStatus?: number;
    deviceStatus?: number;
    batteryStatus?: number;
    batteryVoltage?: number;
    firmwareVersion?: number;
    gatewayId?: string;
    rssi?: number;
    snr?: number;
    channel?: number;
    fCnt?: number;
    fPort?: number;
    dr?: number;
    occurredAt?: string;
    rawPayload?: unknown;
    parsedPayload?: unknown;
  };
};

type SensorSyncDraft = {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
};

function normalizeSensorDevEui(
  value: unknown,
) {
  return String(value ?? '')
    .trim()
    .replace(/[\s:-]/g, '')
    .toUpperCase();
}

@Injectable()
export class SensorEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionEngine:
      SessionEngineService,
  ) {}

  private asRecord(
    value: unknown,
  ): Record<string, any> {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value)
    ) {
      return {};
    }

    return value as Record<string, any>;
  }

  private telemetrySyncIntervalMs() {
    const parsed = Number(
      process.env
        .EDGE_SENSOR_TELEMETRY_SYNC_INTERVAL_MS ??
        300000,
    );

    if (
      !Number.isFinite(parsed) ||
      parsed < 10000
    ) {
      return 300000;
    }

    return Math.floor(parsed);
  }

  private hasTelemetry(
    payload: NonNullable<
      SensorEventInput['payload']
    >,
  ) {
    return [
      payload.deviceStatus,
      payload.batteryStatus,
      payload.batteryVoltage,
      payload.firmwareVersion,
      payload.gatewayId,
      payload.rssi,
      payload.snr,
      payload.channel,
      payload.fCnt,
      payload.fPort,
      payload.dr,
    ].some(
      (value) =>
        value !== null &&
        value !== undefined,
    );
  }

  private resolveTargetSpaceStatus(
    parkingStatus: number | undefined,
  ): SpaceStatus | null {
    if (
      parkingStatus === 1 ||
      parkingStatus === 3
    ) {
      return SpaceStatus.OCCUPIED;
    }

    if (
      parkingStatus === 0 ||
      parkingStatus === 2
    ) {
      return SpaceStatus.EMPTY;
    }

    return null;
  }

  private async shouldEmitTelemetry(
    aggregateId: string,
  ) {
    const latest =
      await this.prisma.domainEvent.findFirst({
        where: {
          aggregateType: 'SensorDevice',
          aggregateId,
          eventType:
            'SENSOR_TELEMETRY_REPORTED_FROM_EDGE',
        },
        select: {
          createdAt: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

    if (!latest) {
      return true;
    }

    return (
      Date.now() -
        latest.createdAt.getTime() >=
      this.telemetrySyncIntervalMs()
    );
  }

  private async persistRawEvent(input: {
    device: any;
    devEui: string;
    sourceEventType: string;
    payload: NonNullable<
      SensorEventInput['payload']
    >;
    occurredAt: Date;
    parkingLotId: string | null;
    parkingSectionId: string | null;
    parkingSpaceId: string | null;
  }) {
    const {
      device,
      devEui,
      sourceEventType,
      payload,
      occurredAt,
      parkingLotId,
      parkingSectionId,
      parkingSpaceId,
    } = input;

    return this.prisma.$transaction(
      async (tx) => {
        const deviceEvent =
          await tx.deviceEvent.create({
            data: {
              devEui,
              deviceId:
                device?.id ?? null,
              parkingLotId,
              parkingSectionId,
              parkingSpaceId,
              source: 'mqtt-daemon',
              eventType:
                sourceEventType,
              parkingStatus:
                payload.parkingStatus ??
                null,
              deviceStatus:
                payload.deviceStatus ??
                null,
              batteryStatus:
                payload.batteryStatus ??
                null,
              batteryVoltage:
                payload.batteryVoltage ??
                null,
              firmwareVersion:
                payload.firmwareVersion ??
                null,
              gatewayId:
                payload.gatewayId ??
                null,
              rssi: payload.rssi ?? null,
              snr: payload.snr ?? null,
              channel:
                payload.channel ?? null,
              fCnt: payload.fCnt ?? null,
              fPort:
                payload.fPort ?? null,
              dr: payload.dr ?? null,
              occurredAt,
              rawPayload:
                payload.rawPayload as any,
              parsedPayload:
                payload.parsedPayload as any,
            },
          });

        const sensorEventLog =
          await tx.sensorEventLog.create({
            data: {
              devEui,
              deviceId:
                device?.id ?? null,
              parkingSpaceId,
              source: 'mqtt-daemon',
              eventType:
                sourceEventType,
              parkingStatus:
                payload.parkingStatus ??
                null,
              deviceStatus:
                payload.deviceStatus ??
                null,
              batteryStatus:
                payload.batteryStatus ??
                null,
              batteryVoltage:
                payload.batteryVoltage ??
                null,
              firmwareVersion:
                payload.firmwareVersion ??
                null,
              gatewayId:
                payload.gatewayId ??
                null,
              rssi: payload.rssi ?? null,
              snr: payload.snr ?? null,
              channel:
                payload.channel ?? null,
              fCnt: payload.fCnt ?? null,
              fPort:
                payload.fPort ?? null,
              dr: payload.dr ?? null,
              occurredAt,
              rawPayload:
                payload.rawPayload as any,
              parsedPayload:
                payload.parsedPayload as any,
            },
          });

        if (device) {
          const metadata =
            this.asRecord(
              device.metadata,
            );

          const currentTelemetry =
            this.asRecord(
              metadata.telemetry,
            );

          await tx.sensorDevice.update({
            where: {
              id: device.id,
            },
            data: {
              lastSeenAt: occurredAt,
              firmwareVersion:
                payload.firmwareVersion !==
                  null &&
                payload.firmwareVersion !==
                  undefined
                  ? String(
                      payload.firmwareVersion,
                    )
                  : undefined,
              metadata: {
                ...metadata,
                telemetry: {
                  ...currentTelemetry,
                  parkingStatus:
                    payload.parkingStatus ??
                    null,
                  deviceStatus:
                    payload.deviceStatus ??
                    null,
                  batteryStatus:
                    payload.batteryStatus ??
                    null,
                  batteryVoltage:
                    payload.batteryVoltage ??
                    null,
                  gatewayId:
                    payload.gatewayId ??
                    null,
                  rssi:
                    payload.rssi ?? null,
                  snr:
                    payload.snr ?? null,
                  channel:
                    payload.channel ??
                    null,
                  fCnt:
                    payload.fCnt ?? null,
                  fPort:
                    payload.fPort ?? null,
                  dr: payload.dr ?? null,
                  occurredAt:
                    occurredAt
                      .toISOString(),
                },
              } as any,
            },
          });
        }

        return {
          deviceEvent,
          sensorEventLog,
        };
      },
    );
  }

  private async enqueueEdgeSensorEvents(
    input: {
      device: any;
      devEui: string;
      sourceEventType: string;
      payload: NonNullable<
        SensorEventInput['payload']
      >;
      occurredAt: Date;
      sensorEventLogId: string;
      parkingLotId: string | null;
      parkingSectionId:
        string | null;
      parkingSpaceId: string | null;
      previousSpaceStatus:
        SpaceStatus | null;
      targetSpaceStatus:
        SpaceStatus | null;
    },
  ) {
    if (
      !isConnectedEdgeProfile() ||
      !input.device ||
      !input.parkingLotId
    ) {
      return [];
    }

    const basePayload = {
      sensorEventLogId:
        input.sensorEventLogId,
      sensorDeviceId:
        input.device.id,
      devEui: input.devEui,
      serialNumber:
        input.device.serialNumber,
      parkingLotId:
        input.parkingLotId,
      parkingLotCode:
        input.device.parkingSpace
          ?.section?.parkingLot
          ?.code ?? null,
      parkingSectionId:
        input.parkingSectionId,
      parkingSectionCode:
        input.device.parkingSpace
          ?.section?.code ?? null,
      parkingSpaceId:
        input.parkingSpaceId,
      parkingSpaceCode:
        input.device.parkingSpace
          ?.code ?? null,
      sourceEventType:
        input.sourceEventType,
      parkingStatus:
        input.payload
          .parkingStatus ?? null,
      deviceStatus:
        input.payload
          .deviceStatus ?? null,
      batteryStatus:
        input.payload
          .batteryStatus ?? null,
      batteryVoltage:
        input.payload
          .batteryVoltage ?? null,
      firmwareVersion:
        input.payload
          .firmwareVersion ?? null,
      gatewayId:
        input.payload.gatewayId ??
        null,
      rssi:
        input.payload.rssi ?? null,
      snr:
        input.payload.snr ?? null,
      channel:
        input.payload.channel ??
        null,
      fCnt:
        input.payload.fCnt ?? null,
      fPort:
        input.payload.fPort ?? null,
      dr: input.payload.dr ?? null,
      occurredAt:
        input.occurredAt
          .toISOString(),
    };

    const drafts: SensorSyncDraft[] =
      [];

    if (
      input.parkingSpaceId &&
      input.targetSpaceStatus &&
      input.previousSpaceStatus !==
        input.targetSpaceStatus
    ) {
      drafts.push({
        eventType:
          'PARKING_SPACE_STATUS_CHANGED_FROM_EDGE',
        aggregateType:
          'ParkingSpace',
        aggregateId:
          input.parkingSpaceId,
        payload: {
          ...basePayload,
          previousStatus:
            input.previousSpaceStatus,
          status:
            input.targetSpaceStatus,
        },
      });
    }

    if (
      this.hasTelemetry(input.payload) &&
      await this.shouldEmitTelemetry(
        input.device.id,
      )
    ) {
      drafts.push({
        eventType:
          'SENSOR_TELEMETRY_REPORTED_FROM_EDGE',
        aggregateType:
          'SensorDevice',
        aggregateId:
          input.device.id,
        payload: {
          ...basePayload,
          rawPayload:
            input.payload.rawPayload ??
            null,
          parsedPayload:
            input.payload
              .parsedPayload ?? null,
        },
      });
    }

    if (drafts.length === 0) {
      return [];
    }

    return this.prisma.$transaction(
      async (tx) => {
        const createdItems = [];

        for (const draft of drafts) {
          const eventId =
            randomUUID();

          const created =
            await tx.domainEvent.create({
              data: {
                eventId,
                aggregateType:
                  draft.aggregateType,
                aggregateId:
                  draft.aggregateId,
                eventType:
                  draft.eventType,
                eventVersion: 1,
                payload:
                  draft.payload as any,
                occurredAt:
                  input.occurredAt,
                outboxes: {
                  create: {
                    destination:
                      'CLOUD',
                    status:
                      'PENDING' as any,
                  },
                },
              },
              include: {
                outboxes: true,
              },
            });

          createdItems.push({
            eventId,
            domainEventId:
              created.id,
            eventType:
              created.eventType,
            outboxId:
              created.outboxes[0]
                ?.id ?? null,
          });
        }

        return createdItems;
      },
    );
  }

  async ingest(
    input: SensorEventInput,
  ) {
    const payload =
      input.payload ?? {};

    const devEui =
      normalizeSensorDevEui(
        payload.devEui,
      );

    if (!devEui) {
      throw new NotFoundException(
        'devEui is required.',
      );
    }

    const occurredAt =
      payload.occurredAt
        ? new Date(
            payload.occurredAt,
          )
        : new Date();

    if (
      Number.isNaN(
        occurredAt.getTime(),
      )
    ) {
      throw new BadRequestException(
        'occurredAt must be a valid date.',
      );
    }

    const device =
      await this.prisma
        .sensorDevice.findFirst({
          where: {
            devEui,
          },
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

    const parkingSpaceId =
      device?.parkingSpaceId ??
      null;

    const parkingSectionId =
      device?.parkingSectionId ??
      device?.parkingSpace
        ?.sectionId ??
      null;

    const parkingLotId =
      device?.parkingLotId ??
      device?.parkingSpace
        ?.section?.parkingLotId ??
      null;

    const previousSpaceStatus =
      device?.parkingSpace
        ?.status ?? null;

    const sourceEventType =
      input.eventType ??
      'parking.sensor.status';

    const {
      deviceEvent,
      sensorEventLog,
    } = await this.persistRawEvent({
      device,
      devEui,
      sourceEventType,
      payload,
      occurredAt,
      parkingLotId,
      parkingSectionId,
      parkingSpaceId,
    });

    const parkingStatus =
      payload.parkingStatus;

    const targetSpaceStatus =
      this.resolveTargetSpaceStatus(
        parkingStatus,
      );

    let mapped =
      Boolean(
        device &&
        parkingSpaceId,
      );

    let action = 'LOG_ONLY';
    let item: any = deviceEvent;

    if (
      device &&
      parkingSpaceId
    ) {
      if (
        parkingStatus === 1 ||
        parkingStatus === 3
      ) {
        const existing =
          await this.prisma
            .parkingSession
            .findFirst({
              where: {
                parkingSpaceId,
                status: 'ACTIVE',
              },
              orderBy: {
                entryTime: 'desc',
              },
            });

        if (existing) {
          await this.prisma
            .parkingSpace.update({
              where: {
                id: parkingSpaceId,
              },
              data: {
                status:
                  SpaceStatus.OCCUPIED,
              },
            });

          action =
            'ENTRY_ALREADY_ACTIVE';
          item = existing;
        } else {
          item =
            await this.sessionEngine
              .entry({
                parkingSpaceId,
                plateNumber: null,
                userId: null,
              });

          action =
            'ENTRY_CREATED';
        }
      } else if (
        parkingStatus === 0 ||
        parkingStatus === 2
      ) {
        const existing =
          await this.prisma
            .parkingSession
            .findFirst({
              where: {
                parkingSpaceId,
                status: 'ACTIVE',
              },
              orderBy: {
                entryTime: 'desc',
              },
            });

        if (!existing) {
          await this.prisma
            .parkingSpace.update({
              where: {
                id: parkingSpaceId,
              },
              data: {
                status:
                  SpaceStatus.EMPTY,
              },
            });

          action =
            'EXIT_NO_ACTIVE_SESSION';
          item = deviceEvent;
        } else {
          item =
            await this.sessionEngine
              .exit(existing.id);

          action =
            'EXIT_CLOSED';
        }
      } else {
        action =
          'UNKNOWN_STATUS_LOG_ONLY';
      }
    } else {
      mapped = false;
    }

    const syncEvents =
      await this
        .enqueueEdgeSensorEvents({
          device,
          devEui,
          sourceEventType,
          payload,
          occurredAt,
          sensorEventLogId:
            sensorEventLog.id,
          parkingLotId,
          parkingSectionId,
          parkingSpaceId,
          previousSpaceStatus,
          targetSpaceStatus,
        });

    return {
      ok: true,
      mapped,
      action,
      item,
      event: deviceEvent,
      sensorEventLog,
      syncEvents,
    };
  }

  async recent(
    limit = 100,
    devEui?: string,
  ) {
    const safeLimit = Math.min(
      Math.max(
        Number(limit) || 100,
        1,
      ),
      500,
    );

    const normalizedKeyword =
      normalizeSensorDevEui(
        devEui,
      );

    const keyword =
      normalizedKeyword
        ? `%${normalizedKeyword}%`
        : null;

    const rows =
      await this.prisma
        .$queryRaw<any[]>`
      SELECT
        psd.id::text AS id,
        psd.dev_eui AS "devEui",
        'parking.sensor.telemetry' AS "eventType",
        psd.parking_status AS "parkingStatus",
        psd.device_status AS "deviceStatus",
        psd.battery_status AS "batteryStatus",
        psd.battery_voltage AS "batteryVoltage",
        psd.firmware_version AS "firmwareVersion",
        psd.gateway_id AS "gatewayId",
        psd.rssi,
        psd.snr,
        psd.channel,
        psd.fcnt AS "fCnt",
        psd.fport AS "fPort",
        psd.dr,
        psd.time AS "occurredAt",
        psd.created_at AS "createdAt",
        space.code AS "parkingSpaceCode",
        section.name AS "parkingSectionName",
        lot.name AS "parkingLotName",
        lot.code AS "parkingLotCode"
      FROM parking_sensor_data psd
      LEFT JOIN "SensorDevice" device
          ON upper(regexp_replace(device."devEui", '[^0-9A-Fa-f]', '', 'g')) =
             upper(regexp_replace(psd.dev_eui, '[^0-9A-Fa-f]', '', 'g'))
      LEFT JOIN "ParkingSpace" space
        ON space.id = device."parkingSpaceId"
      LEFT JOIN "ParkingSection" section
        ON section.id = space."sectionId"
      LEFT JOIN "ParkingLot" lot
        ON lot.id = section."parkingLotId"
      WHERE ${keyword}::text IS NULL
           OR upper(regexp_replace(psd.dev_eui, '[^0-9A-Fa-f]', '', 'g')) LIKE ${keyword}::text
      ORDER BY psd.time DESC
      LIMIT ${safeLimit}
    `;

    const items =
      rows.map((row) => ({
        id: row.id,
        devEui: row.devEui,
        eventType:
          row.eventType,
        parkingStatus:
          row.parkingStatus,
        deviceStatus:
          row.deviceStatus,
        batteryStatus:
          row.batteryStatus,
        batteryVoltage:
          row.batteryVoltage,
        firmwareVersion:
          row.firmwareVersion,
        gatewayId:
          row.gatewayId,
        rssi: row.rssi,
        snr: row.snr,
        channel: row.channel,
        fCnt: row.fCnt,
        fPort: row.fPort,
        dr: row.dr,
        occurredAt:
          row.occurredAt,
        createdAt:
          row.createdAt,
        parkingSpace:
          row.parkingSpaceCode
            ? {
                code:
                  row.parkingSpaceCode,
                section: {
                  name:
                    row.parkingSectionName,
                  parkingLot: {
                    name:
                      row.parkingLotName,
                    code:
                      row.parkingLotCode,
                  },
                },
              }
            : null,
      }));

    return {
      ok: true,
      items,
    };
  }
}
