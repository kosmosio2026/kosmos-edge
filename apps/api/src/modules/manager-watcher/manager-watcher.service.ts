import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ManagerWatcherService {
  constructor(private readonly prisma: PrismaService) {}

  async listApplications(userId: string) {
    const isAdmin = await this.isAdmin(userId);
    const parkingLotIds = isAdmin ? [] : await this.getManageableParkingLotIds(userId);

    if (!isAdmin && parkingLotIds.length === 0) {
      return [];
    }

    return this.prisma.watcherApplication.findMany({
      where: isAdmin
        ? {}
        : {
            parkingLotId: {
              in: parkingLotIds,
            },
          },
      include: {
        watcher: true,
        parkingLot: {
          include: {
            managementCompany: true,
          },
        },
        approvedBy: true,
        rejectedBy: true,
      },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async approve(applicationId: string, managerUserId: string) {
    const application = await this.getAuthorizedApplication(applicationId, managerUserId);

    if (application.status !== 'PENDING') {
      throw new BadRequestException('Application is not pending');
    }

    return this.prisma.$transaction(async (tx) => {
      const approved = await tx.watcherApplication.update({
        where: { id: applicationId },
        data: {
          status: 'APPROVED' as any,
          approvedByUserId: managerUserId,
          approvedAt: new Date(),
        },
      });

      await tx.watcherLotBinding.upsert({
        where: {
          watcherUserId_parkingLotId: {
            watcherUserId: application.watcherUserId,
            parkingLotId: application.parkingLotId,
          },
        },
        create: {
          watcherUserId: application.watcherUserId,
          parkingLotId: application.parkingLotId,
          status: 'ACTIVE',
        },
        update: {
          status: 'ACTIVE',
        },
      });

      return approved;
    });
  }

  async reject(applicationId: string, managerUserId: string, reason?: string) {
    const application = await this.getAuthorizedApplication(applicationId, managerUserId);

    if (application.status !== 'PENDING') {
      throw new BadRequestException('Application is not pending');
    }

    return this.prisma.watcherApplication.update({
      where: { id: applicationId },
      data: {
        status: 'REJECTED' as any,
        rejectedByUserId: managerUserId,
        rejectedAt: new Date(),
        rejectedReason: reason,
      },
    });
  }

  private async getAuthorizedApplication(applicationId: string, userId: string) {
    const application = await this.prisma.watcherApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new NotFoundException('Watcher application not found');
    }

    const isAdmin = await this.isAdmin(userId);
    if (isAdmin) return application;

    const parkingLotIds = await this.getManageableParkingLotIds(userId);

    if (!parkingLotIds.includes(application.parkingLotId)) {
      throw new ForbiddenException('No permission for this watcher application');
    }

    return application;
  }

  private async getManageableParkingLotIds(userId: string) {
    const ids = new Set<string>();

    const tenantUsers = await this.prisma.tenantUser.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      select: {
        tenantId: true,
      },
    });

    const tenantIds = tenantUsers.map((item) => item.tenantId);

    if (tenantIds.length > 0) {
      const lots = await this.prisma.parkingLot.findMany({
        where: {
          managementCompanyId: {
            in: tenantIds,
          },
        },
        select: {
          id: true,
        },
      });

      for (const lot of lots) {
        ids.add(lot.id);
      }
    }

    const managerLots = await this.prisma.managerParkingLot.findMany({
      where: {
        managerProfileUserId: userId,
      },
      select: {
        parkingLotId: true,
      },
    });

    for (const item of managerLots) {
      ids.add(item.parkingLotId);
    }

    return Array.from(ids);
  }

  private async isAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    return Boolean(
      user?.roles?.some((item) => {
        const code = item.role?.code ?? item.role?.name;
        return code === 'ADMIN' || code === 'Admin' || code === 'admin';
      }),
    );
  }
}
