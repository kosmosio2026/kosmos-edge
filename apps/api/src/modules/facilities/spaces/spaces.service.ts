import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ParkingLotOperationSnapshotPublisherService } from '../common/parking-lot-operation-snapshot-publisher.service';
import type { AuthUser } from '../../../common/types/auth-user.type';
import {
  getManagerParkingLotIds,
  getOperatorParkingSectionIds,
  isAdmin,
  isManager,
  isOperator,
} from '../common/facility-scope';

@Injectable()
export class SpacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshotPublisher:
      ParkingLotOperationSnapshotPublisherService,
  ) {}

  private async getScope(user?: AuthUser) {
    if (!user?.sub || isAdmin(user)) return null;

    if (isManager(user)) {
      return {
        parkingLotIds: await getManagerParkingLotIds(this.prisma, user.sub),
        sectionIds: null as string[] | null,
      };
    }

    if (isOperator(user)) {
      return {
        parkingLotIds: null as string[] | null,
        sectionIds: await getOperatorParkingSectionIds(this.prisma, user.sub),
      };
    }

    return null;
  }

  async list(query: any = {}, user?: AuthUser) {
    const search = query.search || query.q;
    const scope = await this.getScope(user);

    if (scope?.parkingLotIds && scope.parkingLotIds.length === 0) return [];
    if (scope?.sectionIds && scope.sectionIds.length === 0) return [];

    const spaces = await this.prisma.parkingSpace.findMany({
      where: {
        ...(query.sectionId ? { sectionId: query.sectionId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(scope?.sectionIds
          ? {
              sectionId: {
                in: scope.sectionIds,
              },
            }
          : {}),
        ...(scope?.parkingLotIds
          ? {
              section: {
                parkingLotId: {
                  in: scope.parkingLotIds,
                },
              },
            }
          : {}),
        ...(search
          ? {
              OR: [
                { code: { contains: search, mode: 'insensitive' } },
                { number: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        section: {
          include: {
            parkingLot: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const sensors = await this.prisma.sensorDevice.findMany({
      where: {
        parkingSpaceId: {
          in: spaces.map((space) => space.id),
        },
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

    const sensorDevEuis = sensors
      .map((sensor) => sensor.devEui)
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase());

    const latestStates = sensorDevEuis.length
      ? await this.prisma.$queryRawUnsafe<any[]>(
          `
          SELECT
            dev_eui,
            parking_status,
            state_since,
            last_message_time,
            rssi,
            snr,
            battery_voltage
          FROM parking_state
          WHERE lower(dev_eui) = ANY($1::text[])
          `,
          sensorDevEuis,
        )
      : [];

    const latestRawRows = sensorDevEuis.length
      ? await this.prisma.$queryRawUnsafe<any[]>(
          `
          SELECT DISTINCT ON (lower(dev_eui))
            dev_eui,
            gateway_id,
            time,
            dr,
            fcnt,
            fport,
            rssi,
            snr,
            channel,
            battery_status,
            battery_voltage,
            device_status,
            parking_status,
            firmware_version
          FROM parking_sensor_data
          WHERE lower(dev_eui) = ANY($1::text[])
          ORDER BY lower(dev_eui), time DESC
          `,
          sensorDevEuis,
        )
      : [];

    const stateByDevEui = new Map(
      latestStates.map((row) => [String(row.dev_eui).toLowerCase(), row]),
    );

    const rawByDevEui = new Map(
      latestRawRows.map((row) => [String(row.dev_eui).toLowerCase(), row]),
    );

    const enrichedSensors = sensors.map((sensor) => {
      const key = sensor.devEui?.toLowerCase();
      const latestState = key ? stateByDevEui.get(key) : null;
      const latestTelemetry = key ? rawByDevEui.get(key) : null;

      return {
        ...sensor,
        lastSeenAt:
          sensor.lastSeenAt ??
          latestState?.last_message_time ??
          latestTelemetry?.time ??
          null,
        firmwareVersion:
          sensor.firmwareVersion ??
          (latestTelemetry?.firmware_version == null
            ? null
            : String(latestTelemetry.firmware_version)),
        latestState: latestState
          ? {
              parkingStatus: latestState.parking_status,
              stateSince: latestState.state_since,
              lastMessageTime: latestState.last_message_time,
              rssi: latestState.rssi,
              snr: latestState.snr,
              batteryVoltage: latestState.battery_voltage,
            }
          : null,
        latestTelemetry: latestTelemetry
          ? {
              gatewayId: latestTelemetry.gateway_id,
              time: latestTelemetry.time,
              dr: latestTelemetry.dr,
              fCnt: latestTelemetry.fcnt,
              fPort: latestTelemetry.fport,
              rssi: latestTelemetry.rssi,
              snr: latestTelemetry.snr,
              channel: latestTelemetry.channel,
              batteryStatus: latestTelemetry.battery_status,
              batteryVoltage: latestTelemetry.battery_voltage,
              deviceStatus: latestTelemetry.device_status,
              parkingStatus: latestTelemetry.parking_status,
              firmwareVersion: latestTelemetry.firmware_version,
            }
          : null,
      };
    });

    const sensorBySpaceId = new Map(
      enrichedSensors.map((sensor) => [sensor.parkingSpaceId, sensor]),
    );

    return spaces.map((space) => ({
      ...space,
      sensorDevice: sensorBySpaceId.get(space.id) ?? null,
    }));
  }

  async get(id: string, user?: AuthUser) {
    const space = await this.prisma.parkingSpace.findUnique({
      where: { id },
      include: {
        section: {
          include: {
            parkingLot: true,
          },
        },
      },
    });

    if (!space) {
      throw new NotFoundException('Parking space not found');
    }

    const scope = await this.getScope(user);

    if (scope?.sectionIds && !scope.sectionIds.includes(space.sectionId)) {
      throw new ForbiddenException('No permission to access this parking space.');
    }

    if (
      scope?.parkingLotIds &&
      !scope.parkingLotIds.includes(space.section.parkingLotId)
    ) {
      throw new ForbiddenException('No permission to access this parking space.');
    }

    return space;
  }

  async create(dto: any) {
    return this.prisma.$transaction(async (tx) => {
      const created =
        await tx.parkingSpace.create({
          data: {
            code: dto.code,
            number: dto.number ?? dto.code,
            type: dto.type ?? 'REGULAR',
            sectionId: dto.sectionId,
            status: dto.status ?? 'EMPTY',
          },
          include: {
            section: {
              include: {
                parkingLot: true,
              },
            },
          },
        });

      await this.snapshotPublisher
        .publishForParkingLot(
          created.section.parkingLot.id,
          tx,
        );

      return created;
    });
  }

  async update(id: string, dto: any) {
    return this.prisma.$transaction(async (tx) => {
      const existing =
        await tx.parkingSpace.findUnique({
          where: { id },
          include: {
            section: {
              select: {
                parkingLotId: true,
              },
            },
          },
        });

      if (!existing) {
        throw new NotFoundException(
          'Parking space not found',
        );
      }

      const updated =
        await tx.parkingSpace.update({
          where: { id },
          data: {
            ...(dto.code !== undefined
              ? { code: dto.code }
              : {}),
            ...(dto.number !== undefined
              ? { number: dto.number }
              : {}),
            ...(dto.type !== undefined
              ? { type: dto.type }
              : {}),
            ...(dto.sectionId !== undefined
              ? { sectionId: dto.sectionId }
              : {}),
            ...(dto.status !== undefined
              ? { status: dto.status }
              : {}),
          },
          include: {
            section: {
              include: {
                parkingLot: true,
              },
            },
          },
        });

      const previousParkingLotId =
        existing.section.parkingLotId;
      const nextParkingLotId =
        updated.section.parkingLot.id;

      if (
        previousParkingLotId !==
        nextParkingLotId
      ) {
        await this.snapshotPublisher
          .publishForParkingLot(
            previousParkingLotId,
            tx,
          );
      }

      await this.snapshotPublisher
        .publishForParkingLot(
          nextParkingLotId,
          tx,
        );

      return updated;
    });
  }

  async remove(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing =
        await tx.parkingSpace.findUnique({
          where: { id },
          include: {
            section: {
              select: {
                parkingLotId: true,
              },
            },
          },
        });

      if (!existing) {
        throw new NotFoundException(
          'Parking space not found',
        );
      }

      await tx.sensorDevice.updateMany({
        where: {
          parkingSpaceId: id,
        },
        data: {
          parkingSpaceId: null,
        },
      });

      const removed =
        await tx.parkingSpace.delete({
          where: { id },
        });

      await this.snapshotPublisher
        .publishForParkingLot(
          existing.section.parkingLotId,
          tx,
        );

      return removed;
    });
  }
}
