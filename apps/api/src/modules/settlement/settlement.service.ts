import { Injectable } from '@nestjs/common';
import { InvoiceStatus, SettlementStatus } from '@parking/db';
import { PrismaService } from '../../prisma/prisma.service';


type SettlementTotals = {
  totalInvoice: number;
  totalPaid: number;
  totalRefunded: number;
  totalOutstanding: number;
  invoiceCount: number;
  paidInvoiceCount: number;
  partiallyPaidInvoiceCount: number;
  unpaidInvoiceCount: number;
  additionalFeeOutstanding: number;
};

function getKstBusinessDateRange(businessDate: string) {
  const start = new Date(`${businessDate}T00:00:00+09:00`);
  const end = new Date(`${businessDate}T23:59:59.999+09:00`);

  return { start, end };
}

@Injectable()
export class SettlementService {
  constructor(private readonly prisma: PrismaService) {}

  private async calculateDailyTotals(
    parkingLotId: string,
    businessDate: string,
  ): Promise<SettlementTotals> {
    const { start, end } = getKstBusinessDateRange(businessDate);

    const [invoices, invoiceCounts, paid, refunded, outstanding, additionalFee] =
      await Promise.all([
        this.prisma.invoice.aggregate({
          _sum: {
            amount: true,
            paidAmount: true,
            unpaidAmount: true,
          },
          where: {
            session: {
              ParkingSpace: {
                section: {
                  parkingLotId,
                },
              },
            },
            createdAt: {
              gte: start,
              lte: end,
            },
          },
        }),
        this.prisma.invoice.groupBy({
          by: ['status'],
          _count: {
            _all: true,
          },
          where: {
            session: {
              ParkingSpace: {
                section: {
                  parkingLotId,
                },
              },
            },
            createdAt: {
              gte: start,
              lte: end,
            },
          },
        }),
        this.prisma.payment.aggregate({
          _sum: { amount: true },
          where: {
            invoice: {
              session: {
                ParkingSpace: {
                  section: {
                    parkingLotId,
                  },
                },
              },
            },
            status: 'SUCCESS',
            createdAt: {
              gte: start,
              lte: end,
            },
          },
        }),
        this.prisma.payment.aggregate({
          _sum: { amount: true },
          where: {
            invoice: {
              session: {
                ParkingSpace: {
                  section: {
                    parkingLotId,
                  },
                },
              },
            },
            status: 'REFUNDED',
            updatedAt: {
              gte: start,
              lte: end,
            },
          },
        }),
        this.prisma.invoice.aggregate({
          _sum: { unpaidAmount: true },
          where: {
            session: {
              ParkingSpace: {
                section: {
                  parkingLotId,
                },
              },
            },
            OR: [
              {
                unpaidAmount: {
                  gt: 0,
                },
              },
              {
                status: {
                  in: [InvoiceStatus.ISSUED, InvoiceStatus.OVERDUE],
                },
              },
            ],
            createdAt: {
              gte: start,
              lte: end,
            },
          },
        }),
        this.prisma.invoice.findMany({
          select: {
            unpaidAmount: true,
            session: {
              select: {
                metadata: true,
              },
            },
          },
          where: {
            unpaidAmount: {
              gt: 0,
            },
            session: {
              ParkingSpace: {
                section: {
                  parkingLotId,
                },
              },
            },
            createdAt: {
              gte: start,
              lte: end,
            },
          },
        }),
      ]);

    const countByStatus = new Map(
      invoiceCounts.map((row) => [row.status, row._count._all]),
    );

    const additionalFeeOutstanding = additionalFee.reduce((sum, invoice) => {
      const metadata =
        invoice.session.metadata &&
        typeof invoice.session.metadata === 'object' &&
        !Array.isArray(invoice.session.metadata)
          ? (invoice.session.metadata as Record<string, unknown>)
          : {};

      const reason = metadata.additionalFeeReason;
      const amount = Number(metadata.additionalFeeAmount ?? 0);

      if (typeof reason === 'string' || amount > 0) {
        return sum + Number(invoice.unpaidAmount ?? 0);
      }

      return sum;
    }, 0);

    return {
      totalInvoice: invoices._sum.amount ?? 0,
      totalPaid:
        invoices._sum.paidAmount ??
        paid._sum.amount ??
        0,
      totalRefunded: refunded._sum.amount ?? 0,
      totalOutstanding:
        invoices._sum.unpaidAmount ??
        outstanding._sum.unpaidAmount ??
        0,
      invoiceCount: invoiceCounts.reduce(
        (sum, row) => sum + row._count._all,
        0,
      ),
      paidInvoiceCount: countByStatus.get(InvoiceStatus.PAID) ?? 0,
      partiallyPaidInvoiceCount:
        countByStatus.get(InvoiceStatus.PARTIALLY_PAID) ?? 0,
      unpaidInvoiceCount:
        (countByStatus.get(InvoiceStatus.ISSUED) ?? 0) +
        (countByStatus.get(InvoiceStatus.OVERDUE) ?? 0),
      additionalFeeOutstanding,
    };
  }

  async previewDailySettlement(parkingLotId: string, businessDate: string) {
    const totals = await this.calculateDailyTotals(parkingLotId, businessDate);

    const existing = await this.prisma.dailySettlement.findUnique({
      where: {
        parkingLotId_businessDate: {
          parkingLotId,
          businessDate,
        },
      },
      include: {
        parkingLot: true,
      },
    });

    const parkingLot = await this.prisma.parkingLot.findUnique({
      where: { id: parkingLotId },
    });

    return {
      ok: true,
      businessDate,
      parkingLotId,
      parkingLot,
      existingSettlement: existing,
      status: existing?.status ?? 'OPEN',
      ...totals,
    };
  }

  async closeDailySettlement(parkingLotId: string, businessDate: string) {
    const { start, end } = getKstBusinessDateRange(businessDate);

    const [invoices, paid, refunded, outstanding] = await Promise.all([
      this.prisma.invoice.aggregate({
        _sum: { amount: true },
        where: {
          session: {
            ParkingSpace: {
              section: {
                parkingLotId,
              },
            },
          },
          createdAt: {
            gte: start,
            lte: end,
          },
        },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          invoice: {
            session: {
              ParkingSpace: {
                section: {
                  parkingLotId,
                },
              },
            },
          },
          status: 'SUCCESS',
          createdAt: {
            gte: start,
            lte: end,
          },
        },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          invoice: {
            session: {
              ParkingSpace: {
                section: {
                  parkingLotId,
                },
              },
            },
          },
          status: 'REFUNDED',
          updatedAt: {
            gte: start,
            lte: end,
          },
        },
      }),
      this.prisma.invoice.aggregate({
        _sum: { unpaidAmount: true },
        where: {
          session: {
            ParkingSpace: {
              section: {
                parkingLotId,
              },
            },
          },
          OR: [
            {
              unpaidAmount: {
                gt: 0,
              },
            },
            {
              status: {
                in: [InvoiceStatus.ISSUED, InvoiceStatus.OVERDUE],
              },
            },
          ],
          createdAt: {
            gte: start,
            lte: end,
          },
        },
      }),
    ]);

    return this.prisma.dailySettlement.upsert({
      where: {
        parkingLotId_businessDate: {
          parkingLotId,
          businessDate,
        },
      },
      update: {
        totalInvoice: invoices._sum?.amount ?? 0,
        totalPaid: paid._sum?.amount ?? 0,
        totalRefunded: refunded._sum?.amount ?? 0,
        totalOutstanding: outstanding._sum?.unpaidAmount ?? 0,
        status: SettlementStatus.CLOSED,
        closedAt: new Date(),
      },
      create: {
        parkingLotId,
        businessDate,
        totalInvoice: invoices._sum?.amount ?? 0,
        totalPaid: paid._sum?.amount ?? 0,
        totalRefunded: refunded._sum?.amount ?? 0,
        totalOutstanding: outstanding._sum?.unpaidAmount ?? 0,
        status: SettlementStatus.CLOSED,
        closedAt: new Date(),
      },
    });
  }

  async listSettlements() {
    return this.prisma.dailySettlement.findMany({
      orderBy: [{ businessDate: 'desc' }, { createdAt: 'desc' }],
      include: {
        parkingLot: true,
      },
    });
  }
}