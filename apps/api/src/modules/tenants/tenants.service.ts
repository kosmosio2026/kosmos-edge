import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        _count: {
          select: {
            tenantUsers: true,
            parkingLots: true,
          },
        },
      },
    });

    return tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      code: tenant.code,
      tenantUsers: tenant._count.tenantUsers,
      parkingLots: tenant._count.parkingLots,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    }));
  }

  async findOne(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: {
        id: tenantId,
      },
      include: {
        _count: {
          select: {
            tenantUsers: true,
            parkingLots: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    return {
      id: tenant.id,
      name: tenant.name,
      code: tenant.code,
      tenantUsers: tenant._count.tenantUsers,
      parkingLots: tenant._count.parkingLots,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  async findParkingLots(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: {
        id: tenantId,
      },
      select: {
        id: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    const parkingLots = await this.prisma.parkingLot.findMany({
      where: {
        tenantId,
      },
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

    return parkingLots.map((lot) => ({
      id: lot.id,
      name: lot.name,
      code: lot.code,
      region: lot.region,
      address: lot.address,
      district: lot.district,
      isActive: lot.isActive,
      sections: lot._count.sections,
      createdAt: lot.createdAt,
      updatedAt: lot.updatedAt,
    }));
  }

  async findUsers(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: {
        id: tenantId,
      },
      select: {
        id: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    const tenantUsers = await this.prisma.tenantUser.findMany({
      where: {
        tenantId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: true,
      },
    });

    return tenantUsers.map((tenantUser) => {
      const user = tenantUser.user as any;

      return {
        id: tenantUser.id,
        tenantId: tenantUser.tenantId,
        userId: tenantUser.userId,
        role: tenantUser.role,
        status: tenantUser.status,
        name: user?.name ?? user?.fullName ?? '-',
        email: user?.email ?? '-',
        phone: user?.phone ?? user?.phoneNumber ?? '-',
        userCreatedAt: user?.createdAt ?? null,
        createdAt: tenantUser.createdAt,
        updatedAt: tenantUser.updatedAt,
      };
    });
  }
}
