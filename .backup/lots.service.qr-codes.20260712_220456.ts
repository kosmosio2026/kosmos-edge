import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ensureActiveParkingLotQr } from '../../../common/parking-lot-qr/parking-lot-qr.helper';
import { CreateParkingLotDto } from './dto/create-parking-lot.dto';
import { UpdateParkingLotDto } from './dto/update-parking-lot.dto';
import type { AuthUser } from '../../../common/types/auth-user.type';
import {
  getManagerParkingLotIds,
  getOperatorParkingLotIds,
  isAdmin,
  isManager,
  isOperator,
} from '../common/facility-scope';

@Injectable()
export class LotsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getScopedParkingLotIds(user?: AuthUser) {
    if (!user?.sub || isAdmin(user)) {
      return null;
    }

    if (isManager(user)) {
      return getManagerParkingLotIds(this.prisma, user.sub);
    }

    if (isOperator(user)) {
      return getOperatorParkingLotIds(this.prisma, user.sub);
    }

    return null;
  }

  async findAll(user?: AuthUser) {
    const scopedParkingLotIds = await this.getScopedParkingLotIds(user);

    if (scopedParkingLotIds && scopedParkingLotIds.length === 0) {
      return [];
    }

    return this.prisma.parkingLot.findMany({
      where: scopedParkingLotIds
        ? {
            id: {
              in: scopedParkingLotIds,
            },
          }
        : {},
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        _count: {
          select: {
            sections: true,
          },
        },
      },
    });
  }

  async findOne(id: string, user?: AuthUser) {
    const scopedParkingLotIds = await this.getScopedParkingLotIds(user);

    if (scopedParkingLotIds && !scopedParkingLotIds.includes(id)) {
      throw new ForbiddenException('No permission to access this parking lot.');
    }

    const lot = await this.prisma.parkingLot.findUnique({
      where: { id },
      include: {
        sections: true,
        _count: {
          select: {
            sections: true,
            sensorDevices: true,
          },
        },
      },
    });

    if (!lot) {
      throw new NotFoundException('Parking lot not found');
    }

    return lot;
  }

  async create(dto: CreateParkingLotDto) {
    const tenant = await this.prisma.tenant.findFirst({
      orderBy: {
        id: 'asc',
      },
    });

    if (!tenant) {
      throw new BadRequestException('Default tenant not found');
    }

    const lot = await this.prisma.parkingLot.create({
      data: {
        code: dto.code,
        name: dto.name,
        region: dto.region?.trim() || null,
        district: dto.district?.trim() || null,
        address: dto.address?.trim() || null,
        lat: dto.lat,
        lng: dto.lng,
        centerLat: dto.lat,
        centerLng: dto.lng,
        representative: dto.representative,
        contact: dto.contact,
        tenantId: tenant.id,
      },
    });

    await ensureActiveParkingLotQr(this.prisma, lot);

    return lot;
  }

  async update(id: string, dto: UpdateParkingLotDto) {
    await this.findOne(id);

    return this.prisma.parkingLot.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        region: dto.region?.trim() || null,
        district: dto.district?.trim() || null,
        address: dto.address?.trim() || null,
        lat: dto.lat,
        lng: dto.lng,
        centerLat: dto.lat,
        centerLng: dto.lng,
        representative: dto.representative,
        contact: dto.contact,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.parkingLot.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}
