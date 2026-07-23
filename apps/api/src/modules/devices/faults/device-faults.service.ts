import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FaultStatus } from '@parking/db';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateDeviceFaultDto } from '../dto/create-device-fault.dto';
import { UpdateDeviceFaultDto } from '../dto/update-device-fault.dto';
import type { AuthUser } from '../../../common/types/auth-user.type';

type FaultScope = {
  isAdmin: boolean;
  lotIds: Set<string>;
  sectionIds: Set<string>;
};

@Injectable()
export class DeviceFaultsService {
  constructor(private readonly prisma: PrismaService) {}

  private getUserId(user?: AuthUser | null) {
    const value = user as any;

    return value?.id ?? value?.userId ?? value?.sub ?? null;
  }

  private getUserRoles(user?: AuthUser | null) {
    const value = user as any;
    const roles = new Set<string>();

    if (Array.isArray(value?.roles)) {
      for (const role of value.roles) {
        if (typeof role === 'string') {
          roles.add(role.toUpperCase());
        } else if (role?.name) {
          roles.add(String(role.name).toUpperCase());
        } else if (role?.role) {
          roles.add(String(role.role).toUpperCase());
        }
      }
    }

    if (value?.role) {
      roles.add(String(value.role).toUpperCase());
    }

    if (value?.roleName) {
      roles.add(String(value.roleName).toUpperCase());
    }

    return [...roles];
  }

  private isAdminUser(user?: AuthUser | null) {
    const roles = this.getUserRoles(user);

    return roles.some((role) =>
      ['ADMIN', 'SYSTEM_SUPERUSER', 'SUPERUSER', 'CLOUD_ADMIN'].includes(role),
    );
  }

  private async getFaultScope(user?: AuthUser | null): Promise<FaultScope> {
    if (this.isAdminUser(user)) {
      return {
        isAdmin: true,
        lotIds: new Set<string>(),
        sectionIds: new Set<string>(),
      };
    }

    const userId = this.getUserId(user);

    if (!userId) {
      return {
        isAdmin: false,
        lotIds: new Set<string>(),
        sectionIds: new Set<string>(),
      };
    }

    const [managerLots, operatorSections] = await Promise.all([
      this.prisma.managerParkingLot.findMany({
        where: {
          managerProfileUserId: userId,
        },
        select: {
          parkingLotId: true,
        },
      }),
      this.prisma.operatorParkingSection.findMany({
        where: {
          operatorProfileUserId: userId,
        },
        select: {
          sectionId: true,
        },
      }),
    ]);

    return {
      isAdmin: false,
      lotIds: new Set(managerLots.map((item) => item.parkingLotId).filter(Boolean)),
      sectionIds: new Set(operatorSections.map((item) => item.sectionId).filter(Boolean)),
    };
  }

  private rowInScope(row: any, scope: FaultScope) {
    if (scope.isAdmin) return true;

    const lotId =
      row.parkingLotId ??
      row.deviceParkingLotId ??
      row.spaceParkingLotId ??
      null;

    const sectionId =
      row.parkingSectionId ??
      row.deviceParkingSectionId ??
      row.spaceSectionId ??
      null;

    if (sectionId && scope.sectionIds.has(String(sectionId))) {
      return true;
    }

    if (lotId && scope.lotIds.has(String(lotId))) {
      return true;
    }

    return false;
  }

  private faultRecordInScope(fault: any, scope: FaultScope) {
    if (scope.isAdmin) return true;

    const sensorDevice = fault?.sensorDevice ?? null;
    const parkingSpace = fault?.parkingSpace ?? null;
    const section = parkingSpace?.section ?? null;

    const lotIds = [
      sensorDevice?.parkingLotId,
      section?.parkingLotId,
      section?.parkingLot?.id,
    ]
      .filter(Boolean)
      .map(String);

    const sectionIds = [
      sensorDevice?.parkingSectionId,
      parkingSpace?.sectionId,
      section?.id,
    ]
      .filter(Boolean)
      .map(String);

    return (
      sectionIds.some((sectionId) => scope.sectionIds.has(sectionId)) ||
      lotIds.some((lotId) => scope.lotIds.has(lotId))
    );
  }

  private deviceInScope(device: any, scope: FaultScope) {
    if (scope.isAdmin) return true;

    const lotIds = [
      device?.parkingLotId,
      device?.parkingSpace?.section?.parkingLotId,
      device?.parkingSpace?.section?.parkingLot?.id,
    ]
      .filter(Boolean)
      .map(String);

    const sectionIds = [
      device?.parkingSectionId,
      device?.parkingSpace?.sectionId,
      device?.parkingSpace?.section?.id,
    ]
      .filter(Boolean)
      .map(String);

    return (
      sectionIds.some((sectionId) => scope.sectionIds.has(sectionId)) ||
      lotIds.some((lotId) => scope.lotIds.has(lotId))
    );
  }

  private async getScopedFaultRecord(id: string, user?: AuthUser | null) {
    const scope = await this.getFaultScope(user);

    const fault = await this.prisma.deviceFault.findUnique({
      where: {
        id,
      },
      include: {
        sensorDevice: true,
        assignedTo: true,
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

    if (!fault || !this.faultRecordInScope(fault, scope)) {
      throw new NotFoundException('Device fault not found');
    }

    return fault;
  }


  async listFaults(user?: AuthUser) {
    const scope = await this.getFaultScope(user);
    const rows = await this.prisma.$queryRaw<any[]>`
      SELECT
        d.id AS "deviceId",
        d.name AS "deviceName",
        d.type AS "deviceType",
        d."serialNumber",
        d."devEui",
          d."parkingLotId" AS "deviceParkingLotId",
          d."parkingSectionId" AS "deviceParkingSectionId",
        d.status AS "deviceStatusText",
        d."createdAt" AS "deviceCreatedAt",
        ps.parking_status AS "stateParkingStatus",
        ps.state_since AS "stateSince",
        ps.last_message_time AS "lastMessageTime",
        ps.rssi AS "stateRssi",
        ps.snr AS "stateSnr",
        ps.battery_voltage AS "stateBatteryVoltage",
        latest.id::text AS "latestTelemetryId",
        latest.time AS "latestTelemetryTime",
        latest.fcnt AS "fCnt",
        latest.parking_status AS "rawParkingStatus",
        latest.device_status AS "rawDeviceStatus",
        latest.battery_status AS "rawBatteryStatus",
        latest.battery_voltage AS "rawBatteryVoltage",
        latest.firmware_version AS "firmwareVersion",
        latest.rssi AS "rawRssi",
        latest.snr AS "rawSnr",
        latest.channel AS "channel",
        sp.id AS "parkingSpaceId",
        sp.code AS "parkingSpaceCode",
          sp."sectionId" AS "spaceSectionId",
          section.id AS "parkingSectionId",
          section."parkingLotId" AS "spaceParkingLotId",
          lot.id AS "parkingLotId",
        section.name AS "parkingSectionName",
        lot.name AS "parkingLotName",
        lot.code AS "parkingLotCode"
      FROM "SensorDevice" d
      LEFT JOIN parking_state ps
        ON lower(ps.dev_eui) = lower(d."devEui")
      LEFT JOIN LATERAL (
        SELECT *
        FROM parking_sensor_data psd
        WHERE lower(psd.dev_eui) = lower(d."devEui")
        ORDER BY psd.time DESC
        LIMIT 1
      ) latest ON true
      LEFT JOIN "ParkingSpace" sp
        ON sp.id = d."parkingSpaceId"
      LEFT JOIN "ParkingSection" section
          ON section.id = COALESCE(d."parkingSectionId", sp."sectionId")
      LEFT JOIN "ParkingLot" lot
          ON lot.id = COALESCE(d."parkingLotId", section."parkingLotId")
      ORDER BY d."createdAt" DESC
    `;

    const now = Date.now();
    const offlineThresholdMs = 1000 * 60 * 30;

    const toNumber = (value: unknown): number | null => {
      if (value === null || value === undefined) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const toDate = (value: unknown): Date | null => {
      if (!value) return null;
      const date = new Date(value as any);
      return Number.isNaN(date.getTime()) ? null : date;
    };

    const severityRank: Record<string, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    const faults: any[] = [];
      const scopedRows = scope.isAdmin ? rows : rows.filter((row) => this.rowInScope(row, scope));

      for (const row of scopedRows) {
      const lastMessageAt = toDate(row.lastMessageTime);
      const latestTelemetryAt = toDate(row.latestTelemetryTime);
      const detectedAt = lastMessageAt ?? latestTelemetryAt ?? toDate(row.deviceCreatedAt) ?? new Date();

      const parkingStatus =
        toNumber(row.stateParkingStatus) ?? toNumber(row.rawParkingStatus);
      const deviceStatus = toNumber(row.rawDeviceStatus);
      const batteryStatus = toNumber(row.rawBatteryStatus);
      const batteryVoltage =
        toNumber(row.stateBatteryVoltage) ?? toNumber(row.rawBatteryVoltage);
      const rssi = toNumber(row.stateRssi) ?? toNumber(row.rawRssi);
      const snr = toNumber(row.stateSnr) ?? toNumber(row.rawSnr);

      const base = {
        deviceId: row.deviceId,
        devEui: row.devEui,
        name: row.deviceName,
        status: 'OPEN',
        detectedAt,
        createdAt: detectedAt,
        device: {
          id: row.deviceId,
          name: row.deviceName,
          type: row.deviceType,
          status: row.deviceStatusText,
          serialNumber: row.serialNumber,
          devEui: row.devEui,
        },
        parkingSpace: row.parkingSpaceId
          ? {
              id: row.parkingSpaceId,
              code: row.parkingSpaceCode,
              section: {
                  id: row.parkingSectionId,
                name: row.parkingSectionName,
                parkingLot: {
                    id: row.parkingLotId,
                  name: row.parkingLotName,
                  code: row.parkingLotCode,
                },
              },
            }
          : null,
        latestTelemetry: {
          id: row.latestTelemetryId,
          time: row.latestTelemetryTime,
          lastMessageTime: row.lastMessageTime,
          parkingStatus,
          deviceStatus,
          batteryStatus,
          batteryVoltage,
          firmwareVersion: row.firmwareVersion,
          rssi,
          snr,
          channel: row.channel,
          fCnt: row.fCnt,
        },
      };

      const pushFault = (
        code: string,
        title: string,
        severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        reason: string,
      ) => {
        faults.push({
          ...base,
          id: `${row.deviceId}-${code}`,
          code,
          title,
          severity,
          grade: severity,
          reason,
          description: reason,
        });
      };

      const deviceStatusText = String(row.deviceStatusText ?? '').toUpperCase();

      if (deviceStatusText === 'FAULT') {
        pushFault(
          'DEVICE_MARKED_FAULT',
          '장치 상태 FAULT',
          'HIGH',
          '장치 마스터 상태가 FAULT로 지정되어 있습니다.',
        );
      }

      if (deviceStatusText === 'OFFLINE') {
        pushFault(
          'DEVICE_MARKED_OFFLINE',
          '장치 상태 OFFLINE',
          'HIGH',
          '장치 마스터 상태가 OFFLINE으로 지정되어 있습니다.',
        );
      }

      if (!lastMessageAt) {
        pushFault(
          'NO_TELEMETRY',
          '수신 데이터 없음',
          'MEDIUM',
          'parking_state 기준 최근 수신 시간이 없습니다.',
        );
      } else {
        const ageMs = now - lastMessageAt.getTime();
        if (ageMs > offlineThresholdMs) {
          pushFault(
            'COMM_OFFLINE',
            '통신 오프라인',
            'HIGH',
            '최근 수신 시간이 30분을 초과했습니다.',
          );
        }
      }

      if (deviceStatus === 1) {
        pushFault(
          'DEVICE_WATER_ABNORMAL',
          '침수이상',
          'CRITICAL',
          '센서 device_status가 1입니다. 침수이상 상태로 판단됩니다.',
        );
      } else if (deviceStatus !== null && deviceStatus >= 2 && deviceStatus <= 14) {
        pushFault(
          'DEVICE_RESERVED_STATUS',
          '기기 상태 Reserved',
          'MEDIUM',
          `센서 device_status가 Reserved 코드(${deviceStatus})입니다.`,
        );
      } else if (deviceStatus === 15 || deviceStatus === 255) {
        pushFault(
          'DEVICE_UNKNOWN_STATUS',
          '기기 상태 UNKNOWN',
          'HIGH',
          '센서 device_status가 UNKNOWN입니다.',
        );
      }

      if (parkingStatus === 2) {
        pushFault(
          'PARKING_EXIT_OBSTACLE',
          '출차 장애물',
          'HIGH',
          '센서 parking_status가 2입니다. 출차 장애물 상태로 판단됩니다.',
        );
      } else if (parkingStatus === 3) {
        pushFault(
          'PARKING_ENTRY_OBSTACLE',
          '입차 장애물',
          'HIGH',
          '센서 parking_status가 3입니다. 입차 장애물 상태로 판단됩니다.',
        );
      } else if (parkingStatus === 255) {
        pushFault(
          'PARKING_UNKNOWN_STATUS',
          '주차 상태 UNKNOWN',
          'MEDIUM',
          '센서 parking_status가 UNKNOWN입니다.',
        );
      }

      if (batteryStatus === 0) {
        pushFault(
          'BATTERY_NEAR_END',
          '배터리 교체 임박',
          'CRITICAL',
          '센서 battery_status가 0입니다. 배터리 교체가 필요합니다.',
        );
      } else if (batteryStatus === 15 || batteryStatus === 255) {
        pushFault(
          'BATTERY_UNKNOWN',
          '배터리 상태 UNKNOWN',
          'MEDIUM',
          '센서 battery_status가 UNKNOWN입니다.',
        );
      }

      if (batteryVoltage !== null && batteryVoltage <= 3.1) {
        pushFault(
          'BATTERY_VOLTAGE_CRITICAL',
          '배터리 전압 위험',
          'CRITICAL',
          `배터리 전압이 ${batteryVoltage.toFixed(2)}V입니다.`,
        );
      } else if (batteryVoltage !== null && batteryVoltage <= 3.3) {
        pushFault(
          'BATTERY_VOLTAGE_LOW',
          '배터리 전압 낮음',
          'MEDIUM',
          `배터리 전압이 ${batteryVoltage.toFixed(2)}V입니다.`,
        );
      }

      if (rssi !== null && rssi <= -120) {
        pushFault(
          'LOW_RSSI',
          '수신 감도 낮음',
          'LOW',
          `RSSI가 ${rssi}dBm입니다.`,
        );
      }

      if (snr !== null && snr <= -10) {
        pushFault(
          'LOW_SNR',
          'SNR 낮음',
          'LOW',
          `SNR이 ${snr}dB입니다.`,
        );
      }
    }

    const mapStoredFault = (saved: any, activeFault?: any) => {
      const parkingSpace = saved.parkingSpace
        ? {
            id: saved.parkingSpace.id,
            code: saved.parkingSpace.code,
            section: saved.parkingSpace.section
              ? {
                  name: saved.parkingSpace.section.name,
                  parkingLot: saved.parkingSpace.section.parkingLot
                    ? {
                        name: saved.parkingSpace.section.parkingLot.name,
                        code: saved.parkingSpace.section.parkingLot.code,
                      }
                    : null,
                }
              : null,
          }
        : activeFault?.parkingSpace ?? null;

      return {
        ...(activeFault ?? {}),
        id: activeFault?.id ?? saved.id,
        faultId: saved.id,
        stored: true,
        deviceId: saved.sensorDeviceId,
        devEui: saved.devEui ?? saved.sensorDevice?.devEui ?? activeFault?.devEui ?? null,
        name: saved.name ?? saved.sensorDevice?.name ?? activeFault?.name ?? null,
        title: saved.title ?? activeFault?.title ?? saved.code ?? '장치 장애',
        description: saved.description ?? activeFault?.description ?? null,
        reason: saved.description ?? activeFault?.reason ?? activeFault?.description ?? null,
        code: saved.code ?? activeFault?.code ?? null,
        severity: saved.severity ?? activeFault?.severity ?? 'MEDIUM',
        grade: saved.severity ?? activeFault?.grade ?? 'MEDIUM',
        status: saved.status,
        detectedAt: saved.detectedAt ?? activeFault?.detectedAt ?? saved.createdAt,
        createdAt: saved.createdAt ?? activeFault?.createdAt,
        actionTaken: saved.actionTaken ?? null,
        actionResult: saved.actionResult ?? null,
        resolvedAt: saved.resolvedAt ?? null,
        closedAt: saved.closedAt ?? null,
        device: {
          id: saved.sensorDeviceId,
          name: saved.sensorDevice?.name ?? saved.name ?? activeFault?.device?.name ?? null,
          type: saved.sensorDevice?.type ?? activeFault?.device?.type ?? null,
          status: saved.sensorDevice?.status ?? activeFault?.device?.status ?? null,
          serialNumber:
            saved.sensorDevice?.serialNumber ?? activeFault?.device?.serialNumber ?? null,
          devEui: saved.devEui ?? saved.sensorDevice?.devEui ?? activeFault?.device?.devEui ?? null,
        },
        parkingSpace,
        latestTelemetry:
          activeFault?.latestTelemetry ??
          (saved.metadata &&
          typeof saved.metadata === 'object' &&
          !Array.isArray(saved.metadata)
            ? (saved.metadata as any).latestTelemetry ?? null
            : null),
        storedFault: {
          id: saved.id,
          status: saved.status,
          actionTaken: saved.actionTaken,
          actionResult: saved.actionResult,
          resolvedAt: saved.resolvedAt,
          closedAt: saved.closedAt,
          createdAt: saved.createdAt,
          updatedAt: saved.updatedAt,
        },
      };
    };

    const sortFaultList = (list: any[]) =>
      list.sort((a: any, b: any) => {
        const severityDiff =
          (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0);

        if (severityDiff !== 0) return severityDiff;

        return (
          new Date(b.detectedAt ?? 0).getTime() -
          new Date(a.detectedAt ?? 0).getTime()
        );
      });

    const loadOpenStoredFaults = async () =>
      this.prisma.deviceFault.findMany({
        where: {
          status: {
            not: FaultStatus.CLOSED,
          },
        },
        include: {
          sensorDevice: true,
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
          detectedAt: 'desc',
        },
      });

      if (!faults.length) {
        const openStoredFaults = (await loadOpenStoredFaults()).filter((saved) =>
          this.faultRecordInScope(saved, scope),
        );
        return sortFaultList(openStoredFaults.map((saved) => mapStoredFault(saved)));
      }

    const deviceIds = [...new Set(faults.map((fault) => fault.deviceId).filter(Boolean))];
    const codes = [...new Set(faults.map((fault) => fault.code).filter(Boolean))];

    const savedFaults =
      deviceIds.length && codes.length
        ? await this.prisma.deviceFault.findMany({
            where: {
              sensorDeviceId: {
                in: deviceIds,
              },
              code: {
                in: codes,
              },
            },
            orderBy: {
              createdAt: 'desc',
            },
          })
        : [];

    const savedByKey = new Map<string, any>();

    for (const saved of savedFaults) {
      const key = `${saved.sensorDeviceId}:${saved.code}`;
      if (!savedByKey.has(key)) {
        savedByKey.set(key, saved);
      }
    }

    for (const fault of faults) {
      const key = `${fault.deviceId}:${fault.code}`;
      const saved = savedByKey.get(key);

      if (saved?.status === FaultStatus.CLOSED) {
        continue;
      }

      if (!saved) {
        const created = await this.prisma.deviceFault.create({
          data: {
            sensorDeviceId: fault.deviceId,
            devEui: fault.devEui ?? fault.device?.devEui ?? null,
            name: fault.name ?? fault.device?.name ?? null,
            parkingSpaceId: fault.parkingSpace?.id ?? null,
            title: fault.title ?? fault.code ?? '장치 장애',
            description: fault.reason ?? fault.description ?? null,
            code: fault.code,
            severity: fault.severity ?? 'MEDIUM',
            status: FaultStatus.OPEN,
            detectedAt: fault.detectedAt ?? new Date(),
            metadata: {
              derivedFaultId: fault.id,
              autoCreatedAt: new Date().toISOString(),
              latestTelemetry: fault.latestTelemetry ?? null,
              parkingSpace: fault.parkingSpace ?? null,
            } as any,
          },
        });

        savedByKey.set(key, created);
      }
    }

    const currentFaultByKey = new Map<string, any>();

    for (const fault of faults) {
      currentFaultByKey.set(`${fault.deviceId}:${fault.code}`, fault);
    }

    const openStoredFaults = (await loadOpenStoredFaults()).filter((saved) =>
      this.faultRecordInScope(saved, scope),
    );

    return sortFaultList(
      openStoredFaults.map((saved) =>
        mapStoredFault(saved, currentFaultByKey.get(`${saved.sensorDeviceId}:${saved.code}`)),
      ),
    );
  }

  async getFaultById(id: string, user?: AuthUser) {
    return this.getScopedFaultRecord(id, user);
  }

  async createFault(dto: CreateDeviceFaultDto, user?: AuthUser) {
    // 🔥 sensorDevice 조회
    const device = await this.prisma.sensorDevice.findUnique({
      where: { id: dto.sensorDeviceId },
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
      throw new NotFoundException('Sensor device not found');
    }

    if (!this.deviceInScope(device, await this.getFaultScope(user))) {
      throw new NotFoundException('Sensor device not found');
    }

    return this.prisma.deviceFault.create({
      data: {
        sensorDeviceId: device.id,
        devEui: device.devEui, // 🔥 필수
        title: dto.title,
        description: dto.description,
        code: dto.code,
        severity: dto.severity,
        status: FaultStatus.OPEN,
      },
    });
  }

  async updateFault(id: string, dto: UpdateDeviceFaultDto, user?: AuthUser) {
    await this.getFaultById(id, user);

    const resolvedAt =
      dto.status === FaultStatus.RESOLVED ? new Date() : undefined;

    const closedAt =
      dto.status === FaultStatus.CLOSED ? new Date() : undefined;

    return this.prisma.deviceFault.update({
      where: { id },
      data: {
        severity: dto.severity,
        status: dto.status,
        assignedToUserId: dto.assignedToUserId,
        actionTaken: dto.actionTaken,
        actionResult: dto.actionResult,
        resolvedAt,
        closedAt,
      },
    });
  }

  async registerAction(id: string, body: any, user?: AuthUser) {
    const actionTaken = String(body?.actionTaken ?? '').trim();

    if (!actionTaken) {
      throw new BadRequestException('조치 내용을 입력해 주세요.');
    }

    const fault = await this.ensureFaultRecord(id, body, user);

    return this.prisma.deviceFault.update({
      where: { id: fault.id },
      data: {
        status: FaultStatus.IN_PROGRESS,
        actionTaken,
        actionResult: body?.actionResult ? String(body.actionResult).trim() : fault.actionResult,
        resolvedAt: null,
        closedAt: null,
        metadata: this.mergeMetadata(fault.metadata, {
          source: 'console',
          derivedFaultId: id,
          lastActionAt: new Date().toISOString(),
          latestTelemetry: body?.latestTelemetry ?? null,
          parkingSpace: body?.parkingSpace ?? null,
        }),
      },
    });
  }

  async closeFault(id: string, body: any, user?: AuthUser) {
    const actionResult =
      String(body?.actionResult ?? '').trim() ||
      String(body?.actionTaken ?? '').trim() ||
      '장애 조치 완료로 종결 처리했습니다.';

    const fault = await this.ensureFaultRecord(id, body, user);
    const now = new Date();

    return this.prisma.deviceFault.update({
      where: { id: fault.id },
      data: {
        status: FaultStatus.CLOSED,
        actionTaken: body?.actionTaken ? String(body.actionTaken).trim() : fault.actionTaken,
        actionResult,
        resolvedAt: fault.resolvedAt ?? now,
        closedAt: now,
        metadata: this.mergeMetadata(fault.metadata, {
          source: 'console',
          derivedFaultId: id,
          closedAt: now.toISOString(),
          latestTelemetry: body?.latestTelemetry ?? null,
          parkingSpace: body?.parkingSpace ?? null,
        }),
      },
    });
  }

  private async ensureFaultRecord(id: string, input: any, user?: AuthUser) {
    const existingById = await this.prisma.deviceFault.findUnique({
      where: { id },
    });

    if (existingById) {
      return existingById;
    }

    const target = this.resolveDerivedFaultTarget(id, input);

    const existingByDeviceAndCode = await this.prisma.deviceFault.findFirst({
      where: {
        sensorDeviceId: target.sensorDeviceId,
        code: target.code,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (existingByDeviceAndCode) {
      return existingByDeviceAndCode;
    }

    const device = await this.prisma.sensorDevice.findUnique({
      where: {
        id: target.sensorDeviceId,
      },
    });

    if (!device) {
      throw new NotFoundException('Sensor device not found');
    }

    return this.prisma.deviceFault.create({
      data: {
        sensorDeviceId: device.id,
        devEui: input?.devEui ?? device.devEui,
        name: input?.name ?? device.name,
        parkingSpaceId: input?.parkingSpaceId ?? device.parkingSpaceId,
        title: input?.title ?? target.code,
        description: input?.description ?? input?.reason ?? null,
        code: target.code,
        severity: input?.severity ?? 'MEDIUM',
        status: FaultStatus.OPEN,
        metadata: {
          derivedFaultId: id,
          latestTelemetry: input?.latestTelemetry ?? null,
          parkingSpace: input?.parkingSpace ?? null,
        },
      },
    });
  }

  private resolveDerivedFaultTarget(id: string, input: any) {
    if (input?.sensorDeviceId && input?.code) {
      return {
        sensorDeviceId: String(input.sensorDeviceId),
        code: String(input.code),
      };
    }

    const separatorIndex = id.lastIndexOf('-');

    if (separatorIndex <= 0 || separatorIndex >= id.length - 1) {
      throw new BadRequestException('장애 식별자를 해석할 수 없습니다.');
    }

    return {
      sensorDeviceId: id.slice(0, separatorIndex),
      code: id.slice(separatorIndex + 1),
    };
  }

  private mergeMetadata(previous: unknown, patch: Record<string, unknown>): any {
    const base =
      previous && typeof previous === 'object' && !Array.isArray(previous)
        ? (previous as Record<string, unknown>)
        : {};

    return {
      ...base,
      ...patch,
    } as any;
  }

}
