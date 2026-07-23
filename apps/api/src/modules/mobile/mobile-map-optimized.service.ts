import { Injectable } from '@nestjs/common';
import { SessionStatus, SpaceStatus } from '@parking/db';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MobileMapOptimizedService {
  constructor(private readonly prisma: PrismaService) {}

  async getMapData(parkingLotId?: string) {
    const spaces = await this.prisma.parkingSpace.findMany({
      where: {
        isActive: true,
        section: {
          ...(parkingLotId ? { parkingLotId } : {}),
          parkingLot: {
            isActive: true,
            operationMode: 'SENSOR',
          },
        },
      },
      select: {
        id: true,
        code: true,
        number: true,
        status: true,
        lat: true,
        lng: true,
        posX: true,
        posY: true,
        type: true,
        section: {
          select: {
            id: true,
            name: true,
            code: true,
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
            status: {
              in: [SessionStatus.ACTIVE, SessionStatus.GRACE_PERIOD],
            },
          },
          take: 1,
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            userId: true,
            entryTime: true,
            registeredAt: true,
          },
        },
      },
      orderBy: [{ sectionId: 'asc' }, { code: 'asc' }],
    });

    return spaces.map((space) => {
      const currentSession = space.sessions[0] ?? null;
      const isRegistered = !!currentSession?.userId;
      const isViolation =
        !!currentSession &&
        !currentSession.userId &&
        !!currentSession.entryTime &&
        new Date(currentSession.entryTime).getTime() <= Date.now() - 10 * 60 * 1000;

      return {
        id: space.id,
        code: space.code,
        number: space.number,
        type: space.type,
        status: space.status,
        lat: space.lat,
        lng: space.lng,
        posX: space.posX,
        posY: space.posY,
        section: space.section,
        lotId: space.section?.parkingLot?.id ?? null,
        lotName: space.section?.parkingLot?.name ?? null,
        region: space.section?.parkingLot?.region ?? null,
        district: space.section?.parkingLot?.district ?? null,
        address: space.section?.parkingLot?.address ?? null,
        sectionId: space.section?.id ?? null,
        sectionName: space.section?.name ?? null,
        occupancyState:
          space.status === SpaceStatus.EMPTY
            ? 'EMPTY'
            : isViolation
              ? 'VIOLATION'
              : isRegistered
                ? 'OCCUPIED_REGISTERED'
                : 'OCCUPIED_UNREGISTERED',
        currentSessionId: currentSession?.id ?? null,
      };
    });
  }
}