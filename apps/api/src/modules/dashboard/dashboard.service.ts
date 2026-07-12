import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionStatus } from '@parking/db';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const total = await this.prisma.parkingSpace.count();

    const occupied = await this.prisma.parkingSession.count({
      where: { status: 'ACTIVE' },
    });

    const revenue = await this.prisma.invoice.aggregate({
      _sum: { amount: true },
    });

    return {
      occupancyRate: total ? (occupied / total) * 100 : 0,
      revenue: revenue._sum.amount ?? 0,
    };
  }
}