import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InvoiceStatus } from '@parking/db';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OverdueWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OverdueWorker.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.run();
    }, 60_000);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async run() {
    const overdue = await this.prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.ISSUED,
        createdAt: {
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      include: {
        session: true,
      },
    });

    for (const inv of overdue) {
      await this.prisma.invoice.update({
        where: { id: inv.id },
        data: { status: InvoiceStatus.OVERDUE },
      });

      const userId = inv.session?.userId;
      if (!userId) continue;

      const overdueCount = await this.prisma.invoice.count({
        where: {
          status: InvoiceStatus.OVERDUE,
          session: {
            userId,
          },
        },
      });

      if (overdueCount >= 3) {
        const existing = await this.prisma.userBlacklist.findFirst({
          where: {
            userId,
            isActive: true,
          },
        });

        if (!existing) {
          await this.prisma.userBlacklist.create({
            data: {
              userId,
              reason: 'Repeated overdue payments',
              isActive: true,
            },
          });

          this.logger.warn(`User blacklisted: ${userId}`);
        }
      }
    }
  }
}