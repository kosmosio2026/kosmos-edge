import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.subscription.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id },
    });

    if (!sub) {
      throw new NotFoundException('Subscription not found');
    }

    return sub;
  }

  async create(dto: {
    userId: string;
    parkingLotId: string;
    vehicleId?: string | null;
    planName: string;
    amount: number;
    startDate: string;
    endDate: string;
    autoRenew?: boolean;
  }) {
    return this.prisma.subscription.create({
      data: {
        userId: dto.userId,
        parkingLotId: dto.parkingLotId,
        vehicleId: dto.vehicleId ?? null,
        planName: dto.planName,
        amount: dto.amount,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        autoRenew: dto.autoRenew ?? false,
        status: 'ACTIVE',
      },
    });
  }

  async update(
    id: string,
    dto: Partial<{
      planName: string;
      amount: number;
      startDate: string;
      endDate: string;
      autoRenew: boolean;
      status: string;
    }>,
  ) {
    await this.getById(id);

    return this.prisma.subscription.update({
      where: { id },
      data: {
        planName: dto.planName,
        amount: dto.amount,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        autoRenew: dto.autoRenew,
        status: dto.status as any,
      },
    });
  }

  async cancel(id: string) {
    await this.getById(id);

    return this.prisma.subscription.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
    });
  }
}