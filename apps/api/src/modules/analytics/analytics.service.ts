import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardSummary() {
    const [
      parkingLots,
      sections,
      spaces,
      activeSessions,
      todayInvoices,
      todayPayments,
      devices,
      offlineDevices,
    ] = await Promise.all([
      this.prisma.parkingLot.count(),
      this.prisma.parkingSection.count(),
      this.prisma.parkingSpace.count(),
      this.prisma.parkingSession.count({
        where: { status: 'ACTIVE' as any },
      }),
      this.prisma.invoice.aggregate({
        _sum: { amount: true },
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
          status: 'SUCCESS' as any,
        },
      }),
      this.prisma.sensorDevice.count(),
      this.prisma.sensorDevice.count({
        where: { status: 'OFFLINE' as any },
      }),
    ]);

    const occupiedSpaces = await this.prisma.parkingSpace.count({
      where: { status: 'OCCUPIED' as any },
    });

    return {
      parking: {
        lots: parkingLots,
        sections,
        spaces,
        occupiedSpaces,
        activeSessions,
      },
      billing: {
        todayInvoiceAmount: todayInvoices._sum.amount ?? 0,
        todayPaymentAmount: todayPayments._sum.amount ?? 0,
      },
      devices: {
        total: devices,
        offline: offlineDevices,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}