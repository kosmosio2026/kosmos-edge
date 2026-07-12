import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OutstandingService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.outstanding.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
      },
    });
  }

  async createFromInvoice(invoiceId: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        session: true,
      },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    return this.prisma.outstanding.upsert({
      where: { invoiceId },
      update: {
        amount: invoice.unpaidAmount,
        status: invoice.unpaidAmount > 0 ? 'OPEN' : 'RESOLVED',
        resolvedAt: invoice.unpaidAmount > 0 ? null : new Date(),
      },
      create: {
        invoiceId,
        sessionId: invoice.sessionId,
        userId: invoice.session.userId,
        amount: invoice.unpaidAmount,
        reason: 'UNPAID_PARKING_FEE',
        status: invoice.unpaidAmount > 0 ? 'OPEN' : 'RESOLVED',
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        resolvedAt: invoice.unpaidAmount > 0 ? null : new Date(),
      },
    });
  }
}