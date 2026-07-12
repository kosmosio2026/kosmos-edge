import { Injectable, NotFoundException } from '@nestjs/common';
import { DeviceStatus, SessionStatus } from '@parking/db';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisPublisher } from '../../common/redis/redis.publisher';

import { DeviceHealthService } from './telemetry/device-health.service';
import { OccupancyEventService } from './occupancy/occupancy-event.service';
import { ConflictException } from '@nestjs/common';

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisPublisher,
    private readonly deviceHealthService: DeviceHealthService,
    private readonly occupancyEventService: OccupancyEventService,
  ) {}

  async listDevices(query: {
    q?: string;
    type?: string;
    status?: string;
  } = {}) {
    const status =
      query.status &&
      Object.values(DeviceStatus).includes(query.status as DeviceStatus)
        ? (query.status as DeviceStatus)
        : undefined;

    const devices = await this.prisma.sensorDevice.findMany({
      where: {
        ...(query.type ? { type: query.type } : {}),
        ...(status ? { status } : {}),
        ...(query.q
          ? {
              OR: [
                {
                  name: {
                    contains: query.q,
                    mode: 'insensitive',
                  },
                },
                {
                  serialNumber: {
                    contains: query.q,
                    mode: 'insensitive',
                  },
                },
                {
                  devEui: {
                    contains: query.q,
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    return Promise.all(
      devices.map((device) => this.deviceHealthService.enrich(device)),
    );
  }

  async getDeviceById(id: string) {
    const device = await this.prisma.sensorDevice.findUnique({
      where: { id },
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

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    return this.deviceHealthService.enrich(device);
  }

async createDevice(dto: any) {
  const devEui =
    typeof dto.devEui === 'string' && dto.devEui.trim()
      ? dto.devEui.trim().toLowerCase()
      : null;

  const serialNumber =
    dto.serialNumber?.trim() ||
    (devEui ? `SENSOR-${devEui}` : `SENSOR-${Date.now()}`);

  if (devEui) {
    const existingByDevEui = await this.prisma.sensorDevice.findUnique({
      where: { devEui },
    });

    if (existingByDevEui) {
      throw new ConflictException('The DevEUI already exists.');
    }
  }

  const existingBySerial = await this.prisma.sensorDevice.findUnique({
    where: { serialNumber },
  });

  if (existingBySerial) {
    throw new ConflictException('The serial number already exists.');
  }

  if (dto.parkingSpaceId) {
    const existingBySpace = await this.prisma.sensorDevice.findUnique({
      where: {
        parkingSpaceId: dto.parkingSpaceId,
      },
    });

    if (existingBySpace) {
      throw new ConflictException(
        'This parking space already has a sensor device. Please replace or unmap the existing sensor first.',
      );
    }
  }

  return this.prisma.sensorDevice.create({
    data: {
      name: dto.name || serialNumber,
      type: dto.type || 'PARKING_SENSOR',
      serialNumber,
      devEui,
      macAddress:
        typeof dto.macAddress === 'string' && dto.macAddress.trim()
          ? dto.macAddress.trim().toLowerCase()
          : null,
      ipAddress:
        typeof dto.ipAddress === 'string' && dto.ipAddress.trim()
          ? dto.ipAddress.trim()
          : null,
      installLocation:
        typeof dto.installLocation === 'string' && dto.installLocation.trim()
          ? dto.installLocation.trim()
          : null,
      status: DeviceStatus.ACTIVE,
      parkingSpaceId: dto.parkingSpaceId || null,
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
}

async replaceSensorForSpace(dto: {
  parkingSpaceId: string;
  type?: string;
  devEui: string;
  macAddress?: string | null;
  ipAddress?: string | null;
  installLocation?: string | null;
  serialNumber?: string;
  name?: string;
}) {
  const devEui = dto.devEui.trim().toLowerCase();

  const serialNumber =
    dto.serialNumber?.trim() || `SENSOR-${devEui}`;

  const existingByDevEui = await this.prisma.sensorDevice.findUnique({
    where: { devEui },
  });

  if (existingByDevEui && existingByDevEui.parkingSpaceId !== dto.parkingSpaceId) {
    throw new ConflictException('The DevEUI already exists.');
  }

  const existingBySpace = await this.prisma.sensorDevice.findUnique({
    where: {
      parkingSpaceId: dto.parkingSpaceId,
    },
  });

  return this.prisma.$transaction(async (tx) => {
    if (existingBySpace && existingBySpace.devEui !== devEui) {
      await tx.sensorDevice.update({
        where: { id: existingBySpace.id },
        data: {
          parkingSpaceId: null,
        },
      });
    }

    if (existingByDevEui) {
      return tx.sensorDevice.update({
        where: { id: existingByDevEui.id },
        data: {
          name: dto.name || existingByDevEui.name,
          type: dto.type || existingByDevEui.type,
          serialNumber,
          parkingSpaceId: dto.parkingSpaceId,
          status: DeviceStatus.ACTIVE,
        },
      });
    }

    return tx.sensorDevice.create({
      data: {
        name: dto.name || serialNumber,
        type: dto.type || 'PARKING_SENSOR',
        serialNumber,
        devEui,
        status: DeviceStatus.ACTIVE,
        parkingSpaceId: dto.parkingSpaceId,
      },
    });
  });
}

async updateDevice(id: string, dto: any) {
  await this.getDeviceById(id);

  return this.prisma.sensorDevice.update({
    where: { id },
    data: {
      name: dto.name,
      type: dto.type,
      serialNumber: dto.serialNumber,
      devEui:
        typeof dto.devEui === 'string'
          ? dto.devEui.trim().toLowerCase()
          : dto.devEui ?? undefined,
      macAddress:
        typeof dto.macAddress === 'string'
          ? dto.macAddress.trim().toLowerCase() || null
          : dto.macAddress ?? undefined,
      ipAddress:
        typeof dto.ipAddress === 'string'
          ? dto.ipAddress.trim() || null
          : dto.ipAddress ?? undefined,
      installLocation:
        typeof dto.installLocation === 'string'
          ? dto.installLocation.trim() || null
          : dto.installLocation ?? undefined,
      status: dto.status as DeviceStatus,
      parkingSpaceId: dto.parkingSpaceId ?? undefined,
    },
  });
}

  async mapDeviceToSpace(id: string, parkingSpaceId: string | null) {
    await this.getDeviceById(id);

    return this.prisma.sensorDevice.update({
      where: { id },
      data: {
        parkingSpaceId,
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
  }

async ingestSensorEvent(dto: any) {
  /**
   * Supports both:
   *
   * {
   *   devEui,
   *   parkingStatus
   * }
   *
   * AND:
   *
   * {
   *   eventType,
   *   payload: {
   *     devEui,
   *     parkingStatus
   *   }
   * }
   */
  const payload = dto.payload ?? dto;

  const devEui =
    payload.devEui ??
    payload.dev_eui;

  const parkingStatus = Number(
    payload.parkingStatus ??
    payload.parking_status
  );

  if (!devEui) {
    return {
      ok: false,
      reason: 'missing_dev_eui',
    };
  }

  if (Number.isNaN(parkingStatus)) {
    return {
      ok: false,
      reason: 'missing_parking_status',
    };
  }

  return this.occupancyEventService.handleParkingSensorStatus(
    devEui.toLowerCase(),
    parkingStatus,
  );
}

  async handleANPR(plateNumber: string) {
    const existing = await this.prisma.parkingSession.findFirst({
      where: {
        plateNumber,
        status: SessionStatus.ACTIVE,
      },
    });

    if (existing) {
      return existing;
    }

    const space = await this.prisma.parkingSpace.findFirst({
      where: {
        status: 'EMPTY' as any,
        isActive: true,
      },
    });

    if (!space) {
      return null;
    }

    const session = await this.prisma.parkingSession.create({
      data: {
        sessionNo: `ANPR-${Date.now()}`,
        parkingSpaceId: space.id,
        plateNumber,
        status: SessionStatus.ACTIVE,
        entryTime: new Date(),
      },
    });

    await this.redis.publish('parking.entry', session);

    return session;
  }

async linkSensorToSpace(devEui: string, parkingSpaceId: string) {
  const normalizedDevEui = devEui.trim().toLowerCase();

  const device = await this.prisma.sensorDevice.findUnique({
    where: {
      devEui: normalizedDevEui,
    },
  });

  if (!device) {
    throw new NotFoundException('Sensor device not found');
  }

  return this.prisma.sensorDevice.update({
    where: {
      devEui: normalizedDevEui,
    },
    data: {
      parkingSpaceId,
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
}
}
