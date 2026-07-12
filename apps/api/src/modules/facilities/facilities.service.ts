import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ensureActiveParkingLotQr } from '../../common/parking-lot-qr/parking-lot-qr.helper';
import { AuthUser } from '../../common/types/auth-user.type';

@Injectable()
export class ParkingLotService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser) {
    if (user.roles?.includes('ADMIN')) {
      return this.prisma.parkingLot.findMany({
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.parkingLot.findMany({
      where: {
        id: {
          in: user.scopes?.parkingLotIds ?? [],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    dto: { name: string; code: string; region?: string | null; district?: string | null; address?: string | null },
    user: AuthUser,
  ) {
    const lot = await this.prisma.parkingLot.create({
      data: {
        name: dto.name,
        code: dto.code,
        region: dto.region ?? null,
        district: dto.district ?? null,
        address: dto.address ?? null,
        tenant: {
          connect: {
            id: user.tenantId!,
          },
        },
      },
    });

    await ensureActiveParkingLotQr(this.prisma, lot);

    return lot;
  }
}