import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BillingSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const [invoiceAgg, paymentAgg, outstandingAgg, subscriptions] = await Promise.all([
      this.prisma.invoice.aggregate({
        _sum: {
          amount: true,
          unpaidAmount: true,
          paidAmount: true,
        },
      }),
      this.prisma.payment.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          status: 'SUCCESS',
        },
      }),
      this.prisma.outstanding.aggregate({
        _sum: {
          amount: true,
        },
        where: {
          status: 'OPEN',
        },
      }),
      this.prisma.subscription.count({
        where: {
          status: 'ACTIVE',
        },
      }),
    ]);

    return {
      invoices: {
        totalAmount: invoiceAgg._sum.amount ?? 0,
        totalPaid: invoiceAgg._sum.paidAmount ?? 0,
        totalUnpaid: invoiceAgg._sum.unpaidAmount ?? 0,
      },
      payments: {
        totalSuccessAmount: paymentAgg._sum.amount ?? 0,
      },
      outstanding: {
        totalOpenAmount: outstandingAgg._sum.amount ?? 0,
      },
      subscriptions: {
        activeCount: subscriptions,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}