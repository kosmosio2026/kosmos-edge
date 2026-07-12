import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ViolationWorker {
  constructor(private prisma: PrismaService) {}

  async check() {
    const now = new Date();

    const sessions = await this.prisma.parkingSession.findMany({
      where: {
        isRegistered: false,
        status: 'ACTIVE',
      },
    });

    for (const s of sessions) {
      if (!s.entryTime) continue;

      const diff = (now.getTime() - s.entryTime.getTime()) / 60000;

      if (diff > 10) {
        await this.prisma.parkingSession.update({
          where: { id: s.id },
          data: {
            status: 'LOST', // 🔥 violation 상태
          },
        });
      }
    }
  }
}