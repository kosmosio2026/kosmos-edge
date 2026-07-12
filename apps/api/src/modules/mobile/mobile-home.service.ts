import { Injectable } from '@nestjs/common';
import { SessionStatus } from '@parking/db';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MobileHomeService {
  constructor(private readonly prisma: PrismaService) {}

  async getHome(userId: string) {
    const [currentSession, vehicles, notifications] = await Promise.all([
      this.prisma.parkingSession.findFirst({
        where: {
          userId,
          status: {
            in: [
              SessionStatus.ACTIVE,
              SessionStatus.GRACE_PERIOD,
              SessionStatus.CLOSED,
              SessionStatus.PAID,
            ],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          vehicle: true,
          ParkingSpace: {
            include: {
              section: {
                include: {
                  parkingLot: true,
                },
              },
            },
          },
          invoice: {
            include: {
              payments: true,
            },
          },
        },
      }),
      this.prisma.userVehicle.findMany({
        where: { userId },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
        include: { vehicle: true },
        take: 5,
      }),
      this.prisma.pushNotification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const unreadCount = notifications.filter(
      (item) => item.status !== 'READ',
    ).length;

    return {
      currentSession,
      vehicles,
      notificationSummary: {
        unreadCount,
        latest: notifications.slice(0, 5),
      },
      generatedAt: new Date().toISOString(),
    };
  }
}