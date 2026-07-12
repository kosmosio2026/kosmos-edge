import { Injectable } from '@nestjs/common';
import { SessionStatus, SpaceStatus } from '@parking/db';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OperatorDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(parkingLotId?: string) {
    const spaceWhere = parkingLotId
      ? {
          section: {
            parkingLotId,
          },
        }
      : {};

    const sessionWhere = parkingLotId
      ? {
          ParkingSpace: {
            section: {
              parkingLotId,
            },
          },
        }
      : {};

    const [spaces, occupiedSpaces, activeSessions, violations, offlineDevices] =
      await Promise.all([
        this.prisma.parkingSpace.count({
          where: {
            ...spaceWhere,
            isActive: true,
          },
        }),
        this.prisma.parkingSpace.count({
          where: {
            ...spaceWhere,
            status: SpaceStatus.OCCUPIED,
          },
        }),
        this.prisma.parkingSession.count({
          where: {
            ...sessionWhere,
            status: SessionStatus.ACTIVE,
          },
        }),
        this.prisma.parkingSession.count({
          where: {
            ...sessionWhere,
            status: SessionStatus.ACTIVE,
            userId: null,
            entryTime: {
              lte: new Date(Date.now() - 10 * 60 * 1000),
            },
          },
        }),
        this.prisma.sensorDevice.count({
          where: parkingLotId
            ? {
                parkingLotId,
                status: 'OFFLINE',
              }
            : {
                status: 'OFFLINE',
              },
        }),
      ]);

    return {
      spaces,
      occupiedSpaces,
      activeSessions,
      violations,
      offlineDevices,
      generatedAt: new Date().toISOString(),
    };
  }

  async getLiveSpaces(parkingLotId?: string) {
    const spaces = await this.prisma.parkingSpace.findMany({
      where: {
        isActive: true,
        section: parkingLotId
          ? {
              parkingLotId,
            }
          : undefined,
      },
      orderBy: [
        {
          section: {
            name: 'asc',
          },
        },
        {
          code: 'asc',
        },
      ],
      include: {
        section: {
          include: {
            parkingLot: true,
          },
        },
        sensorDevice: true,
        sessions: {
          where: {
            status: {
              in: ['ACTIVE', 'GRACE_PERIOD'] as any,
            },
          },
          take: 1,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
            vehicle: {
              select: {
                id: true,
                plateNumber: true,
              },
            },
          },
        },
      },
    });

    return spaces.map((space) => {
      const currentSession = space.sessions[0] ?? null;

      return {
        ...space,
        currentSession,
        isUnregistered:
          !!currentSession &&
          currentSession.status === 'ACTIVE' &&
          !currentSession.userId,
      };
    });
  }
}