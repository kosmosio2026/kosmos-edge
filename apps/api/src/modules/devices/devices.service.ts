import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DeviceStatus, SessionStatus } from '@parking/db';

import { PrismaService } from '../../prisma/prisma.service';
import { RedisPublisher } from '../../common/redis/redis.publisher';

import { DeviceHealthService } from './telemetry/device-health.service';
import { OccupancyEventService } from './occupancy/occupancy-event.service';
import { ParkingLotOperationSnapshotPublisherService } from '../facilities/common/parking-lot-operation-snapshot-publisher.service';
import { SensorDeviceType } from './dto/create-sensor-device.dto';

function optionalDeviceText(value: unknown) {
  const valueText = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  return valueText || null;
}

function normalizeDeviceDevEui(value: unknown) {
  const compact = optionalDeviceText(value)?.replace(/[\s:-]/g, '').toUpperCase() ?? '';

  if (!compact) return null;

  if (!/^[0-9A-F]+$/.test(compact)) {
    throw new BadRequestException('DevEUI는 16자리 HEX 값으로 입력하세요.');
  }

  if (compact.length != 16) {
    throw new BadRequestException('DevEUI는 16자리 HEX 값이어야 합니다.');
  }

  return compact;
}

function requireDeviceDevEui(value: unknown) {
  const devEui = normalizeDeviceDevEui(value);

  if (!devEui) {
    throw new BadRequestException('DevEUI는 필수입니다.');
  }

  return devEui;
}

function normalizeDeviceMacAddress(value: unknown) {
  const compact = optionalDeviceText(value)?.replace(/[\s:-]/g, '').toUpperCase() ?? '';

  if (!compact) return null;

  if (!/^[0-9A-F]+$/.test(compact)) {
    throw new BadRequestException('MAC 주소는 HEX 값으로 입력하세요.');
  }

  if (compact.length != 12) {
    throw new BadRequestException('MAC 주소는 12자리 HEX 값이어야 합니다.');
  }

  return compact;
}

function normalizeDeviceIpAddress(value: unknown) {
  const raw = optionalDeviceText(value)?.replace(/\s+/g, '') ?? '';

  if (!raw) return null;

  const parts = raw.split('.');

  if (parts.length != 4) {
    throw new BadRequestException('IP 주소는 IPv4 형식으로 입력하세요.');
  }

  const normalized = parts.map((part) => {
    if (!/^\d+$/.test(part)) {
      throw new BadRequestException('IP 주소는 숫자와 점(.)만 입력하세요.');
    }

    const parsed = Number(part);

    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 255) {
      throw new BadRequestException('IP 주소 각 항목은 0부터 255 사이여야 합니다.');
    }

    return String(parsed);
  });

  return normalized.join('.');
}


@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisPublisher,
    private readonly deviceHealthService: DeviceHealthService,
    private readonly occupancyEventService: OccupancyEventService,
    private readonly snapshotPublisher:
      ParkingLotOperationSnapshotPublisherService,
  ) {}

  private async resolveParkingSpaceScope(
    client: any,
    parkingSpaceId: string,
  ) {
    const parkingSpace =
      await client.parkingSpace.findUnique({
        where: {
          id: parkingSpaceId,
        },
        select: {
          id: true,
          sectionId: true,
          section: {
            select: {
              parkingLotId: true,
            },
          },
        },
      });

    if (!parkingSpace) {
      throw new NotFoundException(
        `Parking space not found: ${parkingSpaceId}`,
      );
    }

    return {
      parkingSpaceId: parkingSpace.id,
      parkingSectionId:
        parkingSpace.sectionId,
      parkingLotId:
        parkingSpace.section.parkingLotId,
    };
  }

  private resolveSensorParkingLotId(
    sensor: any,
  ): string | null {
    return (
      sensor?.parkingSpace?.section
        ?.parkingLotId ??
      sensor?.parkingSpace?.section
        ?.parkingLot?.id ??
      sensor?.parkingLotId ??
      null
    );
  }

  private async publishSensorSnapshots(
    tx: any,
    parkingLotIds: Array<
      string | null | undefined
    >,
  ) {
    const uniqueParkingLotIds = [
      ...new Set(
        parkingLotIds.filter(
          (value): value is string =>
            typeof value === 'string' &&
            value.length > 0,
        ),
      ),
    ];

    for (
      const parkingLotId
      of uniqueParkingLotIds
    ) {
      await this.snapshotPublisher
        .publishForParkingLot(
          parkingLotId,
          tx,
        );
    }
  }


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
    typeof dto.devEui === 'string' &&
    dto.devEui.trim()
      ? normalizeDeviceDevEui(
          dto.devEui,
        )
      : null;

  const serialNumber =
    dto.serialNumber?.trim() ||
    (
      devEui
        ? `SENSOR-${devEui}`
        : `SENSOR-${Date.now()}`
    );

  if (devEui) {
    const existingByDevEui =
      await this.prisma.sensorDevice
        .findUnique({
          where: { devEui },
        });

    if (existingByDevEui) {
      throw new ConflictException(
        'The DevEUI already exists.',
      );
    }
  }

  const existingBySerial =
    await this.prisma.sensorDevice
      .findUnique({
        where: { serialNumber },
      });

  if (existingBySerial) {
    throw new ConflictException(
      'The serial number already exists.',
    );
  }

  const parkingSpaceScope =
    dto.parkingSpaceId
      ? await this.resolveParkingSpaceScope(
          this.prisma,
          dto.parkingSpaceId,
        )
      : {
          parkingSpaceId: null,
          parkingSectionId: null,
          parkingLotId: null,
        };

  if (parkingSpaceScope.parkingSpaceId) {
    const existingBySpace =
      await this.prisma.sensorDevice
        .findUnique({
          where: {
            parkingSpaceId:
              parkingSpaceScope.parkingSpaceId,
          },
        });

    if (existingBySpace) {
      throw new ConflictException(
        'This parking space already has a sensor device. Please replace or unmap the existing sensor first.',
      );
    }
  }

  return this.prisma.$transaction(
    async (tx) => {
      const created =
        await tx.sensorDevice.create({
          data: {
            name:
              dto.name || serialNumber,
            type:
              dto.type ||
              'PARKING_SENSOR',
            serialNumber,
            devEui,
            macAddress:
              typeof dto.macAddress ===
                'string' &&
              dto.macAddress.trim()
                ? normalizeDeviceMacAddress(
                    dto.macAddress,
                  )
                : null,
            ipAddress:
              typeof dto.ipAddress ===
                'string' &&
              normalizeDeviceIpAddress(
                dto.ipAddress,
              )
                ? normalizeDeviceIpAddress(
                    dto.ipAddress,
                  )
                : null,
            installLocation:
              typeof dto.installLocation ===
                'string' &&
              dto.installLocation.trim()
                ? dto.installLocation.trim()
                : null,
            status: DeviceStatus.ACTIVE,
            ...parkingSpaceScope,
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

      await this.publishSensorSnapshots(
        tx,
        [
          parkingSpaceScope
            .parkingLotId,
        ],
      );

      return created;
    },
  );
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
  const devEui =
    requireDeviceDevEui(dto.devEui);

  const serialNumber =
    dto.serialNumber?.trim() ||
    `SENSOR-${devEui}`;

  const parkingSpaceScope =
    await this.resolveParkingSpaceScope(
      this.prisma,
      dto.parkingSpaceId,
    );

  const existingByDevEui =
    await this.prisma.sensorDevice
      .findUnique({
        where: { devEui },
        include: {
          parkingSpace: {
            include: {
              section: true,
            },
          },
        },
      });

  if (
    existingByDevEui &&
    existingByDevEui.parkingSpaceId !==
      dto.parkingSpaceId
  ) {
    throw new ConflictException(
      'The DevEUI already exists.',
    );
  }

  const existingBySpace =
    await this.prisma.sensorDevice
      .findUnique({
        where: {
          parkingSpaceId:
            dto.parkingSpaceId,
        },
        include: {
          parkingSpace: {
            include: {
              section: true,
            },
          },
        },
      });

  const previousParkingLotIds = [
    this.resolveSensorParkingLotId(
      existingByDevEui,
    ),
    this.resolveSensorParkingLotId(
      existingBySpace,
    ),
  ];

  return this.prisma.$transaction(
    async (tx) => {
      if (
        existingBySpace &&
        existingBySpace.devEui !==
          devEui
      ) {
        await tx.sensorDevice.update({
          where: {
            id: existingBySpace.id,
          },
          data: {
            parkingSpaceId: null,
            parkingSectionId: null,
            parkingLotId:
              this.resolveSensorParkingLotId(
                existingBySpace,
              ),
          },
        });
      }

      let saved;

      if (existingByDevEui) {
        saved =
          await tx.sensorDevice.update({
            where: {
              id: existingByDevEui.id,
            },
            data: {
              name:
                dto.name ||
                existingByDevEui.name,
              type:
                dto.type ||
                existingByDevEui.type,
              serialNumber,
              macAddress:
                dto.macAddress ===
                undefined
                  ? undefined
                  : normalizeDeviceMacAddress(
                      dto.macAddress,
                    ),
              ipAddress:
                dto.ipAddress ===
                undefined
                  ? undefined
                  : normalizeDeviceIpAddress(
                      dto.ipAddress,
                    ),
              installLocation:
                dto.installLocation ===
                undefined
                  ? undefined
                  : optionalDeviceText(
                      dto.installLocation,
                    ),
              status:
                DeviceStatus.ACTIVE,
              ...parkingSpaceScope,
            },
          });
      } else {
        saved =
          await tx.sensorDevice.create({
            data: {
              name:
                dto.name ||
                serialNumber,
              type:
                dto.type ||
                'PARKING_SENSOR',
              serialNumber,
              devEui,
              macAddress:
                normalizeDeviceMacAddress(
                  dto.macAddress,
                ),
              ipAddress:
                normalizeDeviceIpAddress(
                  dto.ipAddress,
                ),
              installLocation:
                optionalDeviceText(
                  dto.installLocation,
                ),
              status:
                DeviceStatus.ACTIVE,
              ...parkingSpaceScope,
            },
          });
      }

      await this.publishSensorSnapshots(
        tx,
        [
          ...previousParkingLotIds,
          parkingSpaceScope
            .parkingLotId,
        ],
      );

      return saved;
    },
  );
}

async updateDevice(
  id: string,
  dto: any,
) {
  return this.prisma.$transaction(
    async (tx) => {
      const existing =
        await tx.sensorDevice.findUnique({
          where: { id },
          include: {
            parkingSpace: {
              include: {
                section: true,
              },
            },
          },
        });

      if (!existing) {
        throw new NotFoundException(
          'Device not found',
        );
      }

      const previousParkingLotId =
        this.resolveSensorParkingLotId(
          existing,
        );

      const hasParkingSpaceId =
        Object.prototype
          .hasOwnProperty.call(
            dto,
            'parkingSpaceId',
          );

      let mappingData:
        Record<string, any> = {};

      if (hasParkingSpaceId) {
        if (dto.parkingSpaceId) {
          mappingData =
            await this.resolveParkingSpaceScope(
              tx,
              dto.parkingSpaceId,
            );
        } else {
          mappingData = {
            parkingSpaceId: null,
            parkingSectionId: null,
            parkingLotId:
              previousParkingLotId,
          };
        }
      }

      const updated =
        await tx.sensorDevice.update({
          where: { id },
          data: {
            name: dto.name,
            type: dto.type,
            serialNumber:
              dto.serialNumber,
            devEui:
              typeof dto.devEui ===
              'string'
                ? normalizeDeviceDevEui(
                    dto.devEui,
                  )
                : dto.devEui ??
                  undefined,
            macAddress:
              typeof dto.macAddress ===
              'string'
                ? normalizeDeviceMacAddress(
                    dto.macAddress,
                  )
                : dto.macAddress ??
                  undefined,
            ipAddress:
              typeof dto.ipAddress ===
              'string'
                ? normalizeDeviceIpAddress(
                    dto.ipAddress,
                  )
                : dto.ipAddress ??
                  undefined,
            installLocation:
              typeof dto.installLocation ===
              'string'
                ? dto.installLocation
                    .trim() || null
                : dto.installLocation ??
                  undefined,
            status:
              dto.status as DeviceStatus,
            ...mappingData,
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

      const nextParkingLotId =
        this.resolveSensorParkingLotId(
          updated,
        );

      await this.publishSensorSnapshots(
        tx,
        [
          previousParkingLotId,
          nextParkingLotId,
        ],
      );

      return updated;
    },
  );
}

  async mapDeviceToSpace(
    id: string,
    parkingSpaceId: string | null,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const existing =
          await tx.sensorDevice.findUnique({
            where: { id },
            include: {
              parkingSpace: {
                include: {
                  section: true,
                },
              },
            },
          });

        if (!existing) {
          throw new NotFoundException(
            'Device not found',
          );
        }

        const previousParkingLotId =
          this.resolveSensorParkingLotId(
            existing,
          );

        const mappingData =
          parkingSpaceId
            ? await this
                .resolveParkingSpaceScope(
                  tx,
                  parkingSpaceId,
                )
            : {
                parkingSpaceId: null,
                parkingSectionId: null,
                parkingLotId:
                  previousParkingLotId,
              };

        const updated =
          await tx.sensorDevice.update({
            where: { id },
            data: mappingData,
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

        await this.publishSensorSnapshots(
          tx,
          [
            previousParkingLotId,
            this.resolveSensorParkingLotId(
              updated,
            ),
          ],
        );

        return updated;
      },
    );
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
    (normalizeDeviceDevEui(devEui) ?? ''),
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

async linkSensorToSpace(
  devEui: string,
  parkingSpaceId: string,
) {
  const normalizedDevEui =
    requireDeviceDevEui(devEui);

  return this.prisma.$transaction(
    async (tx) => {
      const device =
        await tx.sensorDevice.findUnique({
          where: {
            devEui:
              normalizedDevEui,
          },
          include: {
            parkingSpace: {
              include: {
                section: true,
              },
            },
          },
        });

      if (!device) {
        throw new NotFoundException(
          'Sensor device not found',
        );
      }

      const previousParkingLotId =
        this.resolveSensorParkingLotId(
          device,
        );

      const parkingSpaceScope =
        await this.resolveParkingSpaceScope(
          tx,
          parkingSpaceId,
        );

      const updated =
        await tx.sensorDevice.update({
          where: {
            devEui:
              normalizedDevEui,
          },
          data: parkingSpaceScope,
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

      await this.publishSensorSnapshots(
        tx,
        [
          previousParkingLotId,
          parkingSpaceScope
            .parkingLotId,
        ],
      );

      return updated;
    },
  );
}

  async deleteDevice(id: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const existing =
          await tx.sensorDevice.findUnique({
            where: { id },
            include: {
              parkingSpace: {
                include: {
                  section: true,
                },
              },
            },
          });

        if (!existing) {
          throw new NotFoundException(
            'Device not found',
          );
        }

        const previousParkingLotId =
          this.resolveSensorParkingLotId(
            existing,
          );

        const deleted =
          await tx.sensorDevice.delete({
            where: { id },
          });

        /*
         * 현재 sensorInventoryAuthoritative=false이므로
         * Snapshot만으로 Edge 센서가 삭제되지는 않는다.
         * 이전 주차장 Snapshot은 최신 구성을 알리기 위해 발행한다.
         */
        await this.publishSensorSnapshots(
          tx,
          [previousParkingLotId],
        );

        return deleted;
      },
    );
  }

  async validateImportRows(rows: Record<string, unknown>[]) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestException('Excel rows are empty.');
    }

    const textValue = (value: unknown) =>
      typeof value === 'string' ? value.trim() : String(value ?? '').trim();

    const upperValue = (value: unknown) => textValue(value).toUpperCase();
    const allowedTypes = new Set(Object.values(SensorDeviceType));
    const allowedStatuses = new Set(Object.values(DeviceStatus));

    const errors: Array<{ row: number; field: string; message: string }> = [];
    const warnings: Array<{ row: number; field: string; message: string }> = [];

    const serialNumbers = new Set<string>();
    const devEuis = new Set<string>();
    const macAddresses = new Set<string>();

    rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const deviceType = upperValue(row.deviceType || row.type);
      const serialNumber = textValue(row.serialNumber);
      let devEui = '';
      let macAddress = '';

      try {
        devEui = normalizeDeviceDevEui(row.devEui) ?? '';
      } catch (error) {
        errors.push({
          row: rowNumber,
          field: 'devEui',
          message: error instanceof Error ? error.message : 'DevEUI 형식이 올바르지 않습니다.',
        });
      }

      try {
        macAddress = normalizeDeviceMacAddress(row.macAddress) ?? '';
      } catch (error) {
        errors.push({
          row: rowNumber,
          field: 'macAddress',
          message: error instanceof Error ? error.message : 'MAC 주소 형식이 올바르지 않습니다.',
        });
      }

      const status = upperValue(row.status) || 'ACTIVE';

      if (!textValue(row.deviceName || row.name)) {
        errors.push({
          row: rowNumber,
          field: 'deviceName',
          message: 'deviceName 값은 필수입니다.',
        });
      }

      if (!deviceType) {
        errors.push({
          row: rowNumber,
          field: 'deviceType',
          message: 'deviceType 값은 필수입니다.',
        });
      } else if (!allowedTypes.has(deviceType as SensorDeviceType)) {
        errors.push({
          row: rowNumber,
          field: 'deviceType',
          message: `허용되지 않는 deviceType입니다: ${deviceType}`,
        });
      }

      if (!serialNumber) {
        errors.push({
          row: rowNumber,
          field: 'serialNumber',
          message: 'serialNumber 값은 필수입니다.',
        });
      } else if (serialNumbers.has(serialNumber)) {
        errors.push({
          row: rowNumber,
          field: 'serialNumber',
          message: `Excel 안에서 serialNumber가 중복됩니다: ${serialNumber}`,
        });
      }

      if (serialNumber) serialNumbers.add(serialNumber);

      if (deviceType === 'PARKING_SENSOR' && !devEui) {
        errors.push({
          row: rowNumber,
          field: 'devEui',
          message: 'PARKING_SENSOR는 devEui 값이 필수입니다.',
        });
      }

      if (devEui) {
        if (devEuis.has(devEui)) {
          errors.push({
            row: rowNumber,
            field: 'devEui',
            message: `Excel 안에서 devEui가 중복됩니다: ${devEui}`,
          });
        }

        devEuis.add(devEui);
      }

      if (macAddress) {
        if (macAddresses.has(macAddress)) {
          errors.push({
            row: rowNumber,
            field: 'macAddress',
            message: `Excel 안에서 macAddress가 중복됩니다: ${macAddress}`,
          });
        }

        macAddresses.add(macAddress);
      }

      if (status && !allowedStatuses.has(status as DeviceStatus)) {
        errors.push({
          row: rowNumber,
          field: 'status',
          message: `허용되지 않는 status입니다: ${status}`,
        });
      }

      if (textValue(row.sectionCode) && !textValue(row.parkingLotCode)) {
        errors.push({
          row: rowNumber,
          field: 'parkingLotCode',
          message: 'sectionCode를 입력하려면 parkingLotCode가 필요합니다.',
        });
      }

      if (
        textValue(row.spaceCode) &&
        (!textValue(row.parkingLotCode) || !textValue(row.sectionCode))
      ) {
        errors.push({
          row: rowNumber,
          field: 'spaceCode',
          message: 'spaceCode를 입력하려면 parkingLotCode와 sectionCode가 필요합니다.',
        });
      }

      if (!upperValue(row.status)) {
        warnings.push({
          row: rowNumber,
          field: 'status',
          message: 'status가 비어 있어 기본값 ACTIVE로 검증합니다.',
        });
      }
    });

    const existingSerials = serialNumbers.size
      ? await this.prisma.sensorDevice.findMany({
          where: {
            serialNumber: {
              in: Array.from(serialNumbers),
            },
          },
          select: {
            serialNumber: true,
          },
        })
      : [];

    const existingDevEuis = devEuis.size
      ? await this.prisma.sensorDevice.findMany({
          where: {
            devEui: {
              in: Array.from(devEuis),
            },
          },
          select: {
            devEui: true,
          },
        })
      : [];

    const existingMacs = macAddresses.size
      ? await this.prisma.sensorDevice.findMany({
          where: {
            macAddress: {
              in: Array.from(macAddresses),
            },
          },
          select: {
            macAddress: true,
          },
        })
      : [];

    for (const item of existingSerials) {
      errors.push({
        row: 0,
        field: 'serialNumber',
        message: `이미 등록된 serialNumber입니다: ${item.serialNumber}`,
      });
    }

    for (const item of existingDevEuis) {
      if (!item.devEui) continue;

      errors.push({
        row: 0,
        field: 'devEui',
        message: `이미 등록된 devEui입니다: ${item.devEui}`,
      });
    }

    for (const item of existingMacs) {
      if (!item.macAddress) continue;

      errors.push({
        row: 0,
        field: 'macAddress',
        message: `이미 등록된 macAddress입니다: ${item.macAddress}`,
      });
    }

    return {
      ok: errors.length === 0,
      summary: {
        rowCount: rows.length,
        serialNumberCount: serialNumbers.size,
        devEuiCount: devEuis.size,
        macAddressCount: macAddresses.size,
        existingSerialNumberCount: existingSerials.length,
        existingDevEuiCount: existingDevEuis.length,
        existingMacAddressCount: existingMacs.length,
      },
      errors,
      warnings,
      allowedValues: {
        deviceType: Array.from(allowedTypes),
        status: Array.from(allowedStatuses),
      },
    };
  }

}
