import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
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
  constructor(private readonly prisma: PrismaService) {}

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
      orderBy: {
        createdAt: 'desc',
      },
    });

    const sensorBySpaceId = new Map(
      sensors.map((sensor) => [sensor.parkingSpaceId, sensor]),
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
    return this.prisma.parkingSpace.create({
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
  }

  async update(id: string, dto: any) {
    const exists = await this.prisma.parkingSpace.findUnique({
      where: { id },
    });

    if (!exists) {
      throw new NotFoundException('Parking space not found');
    }

    return this.prisma.parkingSpace.update({
      where: { id },
      data: {
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.number !== undefined ? { number: dto.number } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.sectionId !== undefined ? { sectionId: dto.sectionId } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: {
        section: {
          include: {
            parkingLot: true,
          },
        },
      },
    });
  }

  async remove(id: string) {
    const exists = await this.prisma.parkingSpace.findUnique({
      where: { id },
    });

    if (!exists) {
      throw new NotFoundException('Parking space not found');
    }

    await this.prisma.sensorDevice.updateMany({
      where: {
        parkingSpaceId: id,
      },
      data: {
        parkingSpaceId: null,
      },
    });

    return this.prisma.parkingSpace.delete({
      where: { id },
    });
  }
}
