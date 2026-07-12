import { Injectable } from '@nestjs/common';
import { SessionStatus } from '@parking/db';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MobileStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyParkingStatus(userId: string) {
    const session = await this.prisma.parkingSession.findFirst({
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
    });

    return {
      hasActiveParking: !!session,
      session,
      generatedAt: new Date().toISOString(),
    };
  }
}