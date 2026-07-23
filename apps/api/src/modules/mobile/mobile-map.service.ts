import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MobileMapQueryDto } from './dto/mobile-map-query.dto';
import {
  mapMobileOptimizedLots,
  mapMobileOptimizedSpaces,
} from './mobile-map.mapper';

@Injectable()
export class MobileMapService {
  constructor(private readonly prisma: PrismaService) {}

  async getOptimizedMap(userId: string, query: MobileMapQueryDto) {
    const whereLot = query.parkingLotId
      ? {
          id: query.parkingLotId,
          isActive: true,
          operationMode: 'SENSOR' as const,
        }
      : {
          isActive: true,
          operationMode: 'SENSOR' as const,
        };

    // 1. LOT 조회
    const lots = await this.prisma.parkingLot.findMany({
      where: whereLot,
      select: {
        id: true,
        name: true,
        code: true,
        region: true,
        district: true,
        address: true,
        centerLat: true,
        centerLng: true,
        isActive: true,
        operationMode: true,
      },
      orderBy: { name: 'asc' },
    });

    const lotIds = lots.map((lot) => lot.id);

    // 👉 빈 lot 방지용 fallback
    const safeLotIds = lotIds.length ? lotIds : ['__NO_MATCH__'];

    // 2. 병렬 조회
    const [spaces, activeSessions, openFaults, recentMySession] =
      await Promise.all([
        // 공간
        this.prisma.parkingSpace.findMany({
          where: {
            section: {
              parkingLotId: {
                in: safeLotIds,
              },
            },
            isActive: true, // 🔥 DELETED 대신 이걸 사용
          },
          select: {
            id: true,
            code: true,
            status: true,
            posX: true,
            posY: true,
            lat: true,
            lng: true,
            widthMeter: true,
            heightMeter: true,
            rotationDeg: true,
            sectionId: true,
            section: {
              select: {
                id: true,
                name: true,
                parkingLotId: true,
                parkingLot: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                    region: true,
                    district: true,
                    address: true,
                  },
                },
              },
            },
            sessions: {
              where: {
                exitTime: null,
              },
              select: {
                id: true,
                status: true,
                userId: true,
                exitTime: true,
              },
            },
          },
          orderBy: [{ section: { name: 'asc' } }, { code: 'asc' }],
        }),

        // 활성 세션
        this.prisma.parkingSession.findMany({
          where: {
            exitTime: null,
            ParkingSpace: {
              section: {
                parkingLotId: {
                  in: safeLotIds,
                },
              },
            },
          },
          select: {
            id: true,
            userId: true,
            parkingSpaceId: true,
            ParkingSpace: {
              select: {
                section: {
                  select: {
                    parkingLotId: true,
                  },
                },
              },
            },
          },
        }),

        // 장애
        this.prisma.deviceFault.findMany({
          where: {
            status: {
              in: ['OPEN', 'IN_PROGRESS'],
            },
            sensorDevice: {
              parkingSpace: {
                section: {
                  parkingLotId: {
                    in: safeLotIds,
                  },
                },
              },
            },
          },
          select: {
            id: true,
            sensorDevice: {
              select: {
                parkingSpace: {
                  select: {
                    section: {
                      select: {
                        parkingLotId: true,
                      },
                    },
                  },
                },
              },
            },
          },
        }),

        // 내 최근 주차
        this.prisma.parkingSession.findFirst({
          where: {
            userId,
          },
          orderBy: {
            entryTime: 'desc',
          },
          select: {
            id: true,
            parkingSpaceId: true,
          },
        }),
      ]);

    // =========================
    // 📊 집계 로직
    // =========================

    const totalSpacesByLot = new Map<string, number>();
    const occupiedSpacesByLot = new Map<string, number>();
    const activeSessionsByLot = new Map<string, number>();
    const openFaultCountByLot = new Map<string, number>();

    // spaces 기준
    for (const space of spaces) {
      const lotId = space.section?.parkingLot?.id;
      if (!lotId) continue;

      totalSpacesByLot.set(lotId, (totalSpacesByLot.get(lotId) ?? 0) + 1);

      const isOccupied = (space.sessions?.length ?? 0) > 0;
      if (isOccupied) {
        occupiedSpacesByLot.set(
          lotId,
          (occupiedSpacesByLot.get(lotId) ?? 0) + 1,
        );
      }
    }

    // active sessions
    for (const session of activeSessions) {
      const lotId = session.ParkingSpace?.section?.parkingLotId;
      if (!lotId) continue;

      activeSessionsByLot.set(
        lotId,
        (activeSessionsByLot.get(lotId) ?? 0) + 1,
      );
    }

    // faults
    for (const fault of openFaults) {
      const lotId =
        fault.sensorDevice?.parkingSpace?.section?.parkingLotId;
      if (!lotId) continue;

      openFaultCountByLot.set(
        lotId,
        (openFaultCountByLot.get(lotId) ?? 0) + 1,
      );
    }

    // =========================
    // 📦 LOT 결과 구성
    // =========================

    const lotsWithStats = lots.map((lot) => {
      const totalSpaces = totalSpacesByLot.get(lot.id) ?? 0;
      const occupiedSpaces = occupiedSpacesByLot.get(lot.id) ?? 0;
      const availableSpaces = Math.max(totalSpaces - occupiedSpaces, 0);
      const activeSessionCount = activeSessionsByLot.get(lot.id) ?? 0;
      const openFaultCount = openFaultCountByLot.get(lot.id) ?? 0;

      return {
        ...lot,
        totalSpaces,
        availableSpaces,
        occupiedSpaces,
        activeSessions: activeSessionCount,
        openFaultCount,
      };
    });

    const mappedLots = mapMobileOptimizedLots({
      lots: lotsWithStats,
    });

    const mappedSpaces = mapMobileOptimizedSpaces({
      spaces,
      recentSpaceId: recentMySession?.parkingSpaceId ?? null,
    });

    return {
      parkingLots: mappedLots,
      spaces: mappedSpaces,
    };
  }

  // =====================================================
  // 🔽 Controller에서 쓰는 기존 API도 유지 (호환)
  // =====================================================

  async listMapSpaces(parkingLotId?: string) {
    return this.getOptimizedMap('__PUBLIC__', {
      parkingLotId,
    } as MobileMapQueryDto);
  }

  async listRegisterableOccupiedSpaces(parkingLotId?: string) {
    const data = await this.listMapSpaces(parkingLotId);

    return data.spaces.filter((s: any) => s.isOccupied);
  }
}