import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FeeEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(sessionId: string): Promise<number> {
    const session = await this.prisma.parkingSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        userId: true,
        entryTime: true,
        parkingSpaceId: true,
      },
    });

    if (!session?.entryTime || !session.parkingSpaceId) {
      return 0;
    }

    const parkingSpace = await this.prisma.parkingSpace.findUnique({
      where: { id: session.parkingSpaceId },
      select: {
        id: true,
        sectionId: true,
      },
    });

    if (!parkingSpace?.sectionId) {
      return 0;
    }

    const section = await this.prisma.parkingSection.findUnique({
      where: { id: parkingSpace.sectionId },
      select: {
        id: true,
        parkingLotId: true,
      },
    });

    const parkingLotId = section?.parkingLotId;
    if (!parkingLotId) {
      return 0;
    }

    const now = new Date();

    // 월정액이면 0원
    if (session.userId) {
      const subscription = await this.prisma.subscription.findFirst({
  where: {
    userId: session.userId ?? undefined,
    parkingLotId,
    status: 'ACTIVE',
    startDate: { lte: now },
    endDate: { gte: now },
  },
});

if (subscription) {
  return 0;
}
    }

    const policy = await this.prisma.feePolicy.findFirst({
      where: {
        parkingLotId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        baseMinutes: true,
        baseFee: true,
        unitMinutes: true,
        unitFee: true,
        dailyMax: true,
        graceMinutes: true,
        memberDiscountPercent: true,
      },
    });

    if (!policy) {
      return 0;
    }

    const totalMinutes = Math.ceil(
      (Date.now() - new Date(session.entryTime).getTime()) / 60000,
    );

    let amount = 0;

    if (totalMinutes <= policy.graceMinutes) {
      amount = 0;
    } else if (totalMinutes <= policy.baseMinutes) {
      amount = policy.baseFee;
    } else {
      const extraMinutes = totalMinutes - policy.baseMinutes;
      const units = Math.ceil(extraMinutes / policy.unitMinutes);
      amount = policy.baseFee + units * policy.unitFee;
    }

    const hour = now.getHours();

    const timeRule = await this.prisma.feePolicyTimeRule.findFirst({
      where: {
        feePolicyId: policy.id,
        startHour: { lte: hour },
        endHour: { gt: hour },
      },
      select: {
        multiplier: true,
      },
    });

    if (timeRule) {
      amount = Math.floor(amount * timeRule.multiplier);
    }

    if (session.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: session.userId },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });

      const isMember =
        user?.roles?.some((r) => r.role.code === 'MEMBER') ?? false;

      if (isMember && policy.memberDiscountPercent > 0) {
        amount = Math.floor(
          amount * (1 - policy.memberDiscountPercent / 100),
        );
      }
    }

    return Math.max(0, amount);
  }
}