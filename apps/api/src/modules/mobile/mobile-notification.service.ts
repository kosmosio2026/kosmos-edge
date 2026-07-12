import { Injectable } from '@nestjs/common';
import { Prisma, PushNotificationStatus } from '@parking/db';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MobileNotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ) {
    return this.prisma.pushNotification.create({
      data: {
        userId,
        title,
        body,
        data: data as any | undefined,
        status: PushNotificationStatus.PENDING,
      },
    });
  }

  async listMyNotifications(userId: string) {
    return this.prisma.pushNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    return this.prisma.pushNotification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        status: PushNotificationStatus.READ,
        readAt: new Date(),
      },
    });
  }

  async registerPushToken(userId: string, token: string, platform?: string) {
    return this.prisma.pushToken.upsert({
      where: { token },
      update: {
        userId,
        platform,
        isActive: true,
      },
      create: {
        userId,
        token,
        platform,
        isActive: true,
      },
    });
  }
}