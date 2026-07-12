import { Injectable, NotFoundException } from '@nestjs/common';
import { SpaceStatus } from '@parking/db';

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

@Injectable()
export class SensorEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionEngine: SessionEngineService,
  ) {}

  async ingest(input: SensorEventInput) {
    const payload = input.payload ?? {};
    const devEui = payload.devEui?.trim();

    if (!devEui) {
      throw new NotFoundException('devEui is required.');
    }

    const device = await this.prisma.sensorDevice.findFirst({
      where: {
        devEui,
      },
      include: {
        parkingSpace: true,
      },
    });

    const parkingSpaceId = device?.parkingSpaceId ?? null;
    const occurredAt = payload.occurredAt
      ? new Date(payload.occurredAt)
      : new Date();

    const log = await this.prisma.deviceEvent.create({
      data: {
        devEui,
        deviceId: device?.id ?? null,
        parkingSpaceId,
        source: 'mqtt-daemon',
        eventType: input.eventType ?? 'parking.sensor.status',
        parkingStatus: payload.parkingStatus ?? null,
        deviceStatus: payload.deviceStatus ?? null,
        batteryStatus: payload.batteryStatus ?? null,
        batteryVoltage: payload.batteryVoltage ?? null,
        firmwareVersion: payload.firmwareVersion ?? null,
        gatewayId: payload.gatewayId ?? null,
        rssi: payload.rssi ?? null,
        snr: payload.snr ?? null,
        channel: payload.channel ?? null,
        fCnt: payload.fCnt ?? null,
        fPort: payload.fPort ?? null,
        dr: payload.dr ?? null,
        occurredAt,
        rawPayload: payload.rawPayload as any,
        parsedPayload: payload.parsedPayload as any,
      },
    });

    if (!device || !parkingSpaceId) {
      return {
        ok: true,
        mapped: false,
        action: 'LOG_ONLY',
        item: log,
      };
    }

    const parkingStatus = payload.parkingStatus;

    // proto.rs 기준:
    // 0 = ExitNormal
    // 1 = EntryNormal
    // 2 = ExitObstacleError
    // 3 = EntryObstacleError
    if (parkingStatus === 1 || parkingStatus === 3) {
      const existing = await this.prisma.parkingSession.findFirst({
        where: {
          parkingSpaceId,
          status: 'ACTIVE',
        },
        orderBy: {
          entryTime: 'desc',
        },
      });

      if (existing) {
        await this.prisma.parkingSpace.update({
          where: { id: parkingSpaceId },
          data: { status: SpaceStatus.OCCUPIED },
        });

        return {
          ok: true,
          mapped: true,
          action: 'ENTRY_ALREADY_ACTIVE',
          item: existing,
          event: log,
        };
      }

      const session = await this.sessionEngine.entry({
        parkingSpaceId,
        plateNumber: null,
        userId: null,
      });

      return {
        ok: true,
        mapped: true,
        action: 'ENTRY_CREATED',
        item: session,
        event: log,
      };
    }

    if (parkingStatus === 0 || parkingStatus === 2) {
      const existing = await this.prisma.parkingSession.findFirst({
        where: {
          parkingSpaceId,
          status: 'ACTIVE',
        },
        orderBy: {
          entryTime: 'desc',
        },
      });

      if (!existing) {
        await this.prisma.parkingSpace.update({
          where: { id: parkingSpaceId },
          data: { status: SpaceStatus.EMPTY },
        });

        return {
          ok: true,
          mapped: true,
          action: 'EXIT_NO_ACTIVE_SESSION',
          event: log,
        };
      }

      const session = await this.sessionEngine.exit(existing.id);

      return {
        ok: true,
        mapped: true,
        action: 'EXIT_CLOSED',
        item: session,
        event: log,
      };
    }

    return {
      ok: true,
      mapped: true,
      action: 'UNKNOWN_STATUS_LOG_ONLY',
      item: log,
    };
  }

  async recent(limit = 100) {
    const items = await this.prisma.deviceEvent.findMany({
      orderBy: {
        receivedAt: 'desc',
      },
      take: Math.min(Math.max(limit, 1), 500),
    });

    return {
      ok: true,
      items,
    };
  }
}
