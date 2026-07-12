import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateSectionDto } from './dto/create-section.dto';
import { UpdateSectionDto } from './dto/update-section.dto';
import { SectionListQueryDto } from './queries/section-list-query.dto';
import type { AuthUser } from '../../../common/types/auth-user.type';
import {
  getManagerParkingLotIds,
  getOperatorParkingSectionIds,
  isAdmin,
  isManager,
  isOperator,
} from '../common/facility-scope';

@Injectable()
export class SectionsService {
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

  async list(query: SectionListQueryDto, user?: AuthUser) {
    const search = query.search ?? query.q;
    const scope = await this.getScope(user);

    if (scope?.parkingLotIds && scope.parkingLotIds.length === 0) return [];
    if (scope?.sectionIds && scope.sectionIds.length === 0) return [];

    return this.prisma.parkingSection.findMany({
      where: {
        ...(query.parkingLotId
          ? {
              parkingLotId: query.parkingLotId,
            }
          : {}),
        ...(scope?.parkingLotIds
          ? {
              parkingLotId: {
                in: scope.parkingLotIds,
              },
            }
          : {}),
        ...(scope?.sectionIds
          ? {
              id: {
                in: scope.sectionIds,
              },
            }
          : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        parkingLot: true,
        spaces: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async get(id: string, user?: AuthUser) {
    const item = await this.prisma.parkingSection.findUnique({
      where: { id },
      include: {
        parkingLot: true,
        spaces: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Parking section not found');
    }

    const scope = await this.getScope(user);

    if (scope?.sectionIds && !scope.sectionIds.includes(item.id)) {
      throw new ForbiddenException('No permission to access this parking section.');
    }

    if (
      scope?.parkingLotIds &&
      !scope.parkingLotIds.includes(item.parkingLotId)
    ) {
      throw new ForbiddenException('No permission to access this parking section.');
    }

    return item;
  }

  create(dto: CreateSectionDto) {
    return this.prisma.parkingSection.create({
      data: {
        parkingLotId: dto.parkingLotId,
        name: dto.name,
        code: dto.code,
        isActive: dto.isActive ?? true,
      },
    });
  }

  update(id: string, dto: UpdateSectionDto) {
    return this.prisma.parkingSection.update({
      where: { id },
      data: {
        parkingLotId: dto.parkingLotId,
        name: dto.name,
        code: dto.code,
        isActive: dto.isActive,
      },
    });
  }

  remove(id: string) {
    return this.prisma.parkingSection.delete({
      where: { id },
    });
  }
}
