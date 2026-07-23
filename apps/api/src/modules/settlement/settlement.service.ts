import { Injectable } from '@nestjs/common';
import { InvoiceStatus, SettlementStatus } from '@parking/db';
import { PrismaService } from '../../prisma/prisma.service';

type SettlementTotals = {
  totalInvoice: number;
  totalPaid: number;
  totalRefunded: number;
  totalOutstanding: number;
  totalReceivable: number;
  parkingFeeOutstanding: number;
  additionalFeeOutstanding: number;
  invoiceCount: number;
  paidInvoiceCount: number;
  partiallyPaidInvoiceCount: number;
  unpaidInvoiceCount: number;
  additionalFeeInvoiceCount: number;
};

type SettlementListQuery = {
  parkingLotId?: string;
  year?: string;
  month?: string;
};

type ParkingSpaceIdRow = {
  id: string;
};

type SettlementParkingLotRow = {
  id: string;
  name: string | null;
  code: string | null;
  isActive: boolean;
  spaceCount: number;
};

type DailySettlementRow = {
  id: string;
  parkingLotId: string;
  businessDate: string;
  totalInvoice: number;
  totalPaid: number;
  totalRefunded: number;
  totalOutstanding: number;
  status: string;
  closedAt: Date | null;
  closedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  parkingLotName: string | null;
  parkingLotCode: string | null;
};

function getKstBusinessDateRange(businessDate: string) {
  const start = new Date(`${businessDate}T00:00:00+09:00`);
  const end = new Date(`${businessDate}T23:59:59.999+09:00`);

  return { start, end };
}

function getInvoiceKind(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return 'PARKING_FEE';
  }

  const value = (metadata as Record<string, unknown>).invoiceKind;

  return value === 'ADDITIONAL_FEE' ? 'ADDITIONAL_FEE' : 'PARKING_FEE';
}

function emptyTotals(): SettlementTotals {
  return {
    totalInvoice: 0,
    totalPaid: 0,
    totalRefunded: 0,
    totalOutstanding: 0,
    totalReceivable: 0,
    parkingFeeOutstanding: 0,
    additionalFeeOutstanding: 0,
    invoiceCount: 0,
    paidInvoiceCount: 0,
    partiallyPaidInvoiceCount: 0,
    unpaidInvoiceCount: 0,
    additionalFeeInvoiceCount: 0,
  };
}

function normalizeYear(value?: string) {
  if (!value) return null;
  return /^\d{4}$/.test(value) ? value : null;
}

function normalizeMonth(value?: string) {
  if (!value) return null;

  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < 1 || numberValue > 12) {
    return null;
  }

  return String(numberValue).padStart(2, '0');
}

@Injectable()
export class SettlementService {
  constructor(private readonly prisma: PrismaService) {}

  async listSettlementParkingLots() {
    const rows = await this.prisma.$queryRaw<SettlementParkingLotRow[]>`
      SELECT
        lot.id,
        lot.name,
        lot.code,
        lot."isActive",
        COUNT(space.id)::int AS "spaceCount"
      FROM "ParkingLot" lot
      LEFT JOIN "ParkingSection" section
        ON section."parkingLotId" = lot.id
      LEFT JOIN "ParkingSpace" space
        ON space."sectionId" = section.id
      WHERE lot."isActive" = true
      GROUP BY lot.id, lot.name, lot.code, lot."isActive"
      HAVING COUNT(space.id) > 0
      ORDER BY lot.name ASC, lot.code ASC
    `;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code,
      isActive: row.isActive,
      spaceCount: Number(row.spaceCount ?? 0),
    }));
  }

  private async getSessionIdsByParkingLot(parkingLotId: string) {
    const parkingSpaces = await this.prisma.$queryRaw<ParkingSpaceIdRow[]>`
      SELECT ps.id
      FROM "ParkingSpace" ps
      INNER JOIN "ParkingSection" section
        ON section.id = ps."sectionId"
      WHERE section."parkingLotId" = ${parkingLotId}
    `;

    const parkingSpaceIds = parkingSpaces.map((row) => row.id);

    if (parkingSpaceIds.length === 0) {
      return [];
    }

    const sessions = await this.prisma.parkingSession.findMany({
      select: {
        id: true,
      },
      where: {
        parkingSpaceId: {
          in: parkingSpaceIds,
        },
      },
    });

    return sessions.map((session) => session.id);
  }

  private async calculateDailyTotals(
    parkingLotId: string,
    businessDate: string,
  ): Promise<SettlementTotals> {
    const { start, end } = getKstBusinessDateRange(businessDate);
    const sessionIds = await this.getSessionIdsByParkingLot(parkingLotId);

    if (sessionIds.length === 0) {
      return emptyTotals();
    }

    const invoices = await this.prisma.invoice.findMany({
      select: {
        id: true,
        status: true,
        amount: true,
        paidAmount: true,
        unpaidAmount: true,
        metadata: true,
      },
      where: {
        sessionId: {
          in: sessionIds,
        },
        status: {
          notIn: [InvoiceStatus.VOID, InvoiceStatus.CANCELLED],
        },
        createdAt: {
          gte: start,
          lte: end,
        },
      },
    });

    if (invoices.length === 0) {
      return emptyTotals();
    }

    const invoiceIds = invoices.map((invoice) => invoice.id);

    const refunded = await this.prisma.payment.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        invoiceId: {
          in: invoiceIds,
        },
        status: 'REFUNDED',
        updatedAt: {
          gte: start,
          lte: end,
        },
      },
    });

    const countByStatus = new Map<string, number>();

    for (const invoice of invoices) {
      const status = String(invoice.status);
      countByStatus.set(status, (countByStatus.get(status) ?? 0) + 1);
    }

    const unpaidStatuses = new Set<string>([
      String(InvoiceStatus.ISSUED),
      String(InvoiceStatus.OVERDUE),
      String(InvoiceStatus.PARTIALLY_PAID),
    ]);

    const outstandingInvoices = invoices.filter((invoice) => {
      const status = String(invoice.status);

      return (
        Number(invoice.unpaidAmount ?? 0) > 0 &&
        unpaidStatuses.has(status)
      );
    });

    const additionalFeeInvoices = outstandingInvoices.filter(
      (invoice) => getInvoiceKind(invoice.metadata) === 'ADDITIONAL_FEE',
    );

    const totalInvoice = invoices.reduce(
      (sum, invoice) => sum + Number(invoice.amount ?? 0),
      0,
    );

    const totalPaid = invoices.reduce(
      (sum, invoice) => sum + Number(invoice.paidAmount ?? 0),
      0,
    );

    const totalOutstanding = outstandingInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.unpaidAmount ?? 0),
      0,
    );

    const additionalFeeOutstanding = additionalFeeInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.unpaidAmount ?? 0),
      0,
    );

    const parkingFeeOutstanding = Math.max(
      0,
      totalOutstanding - additionalFeeOutstanding,
    );

    return {
      totalInvoice,
      totalPaid,
      totalRefunded: refunded._sum.amount ?? 0,
      totalOutstanding,
      totalReceivable: totalOutstanding,
      parkingFeeOutstanding,
      additionalFeeOutstanding,
      invoiceCount: invoices.length,
      paidInvoiceCount: countByStatus.get(String(InvoiceStatus.PAID)) ?? 0,
      partiallyPaidInvoiceCount:
        countByStatus.get(String(InvoiceStatus.PARTIALLY_PAID)) ?? 0,
      unpaidInvoiceCount: outstandingInvoices.length,
      additionalFeeInvoiceCount: additionalFeeInvoices.length,
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
    });

    const parkingLot = await this.prisma.parkingLot.findUnique({
      where: { id: parkingLotId },
      select: {
        id: true,
        name: true,
        code: true,
      },
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

  async closeDailySettlement(
    parkingLotId: string,
    businessDate: string,
    closedByUserId?: string | null,
  ) {
    const totals = await this.calculateDailyTotals(parkingLotId, businessDate);

    return this.prisma.dailySettlement.upsert({
      where: {
        parkingLotId_businessDate: {
          parkingLotId,
          businessDate,
        },
      },
      update: {
        totalInvoice: totals.totalInvoice,
        totalPaid: totals.totalPaid,
        totalRefunded: totals.totalRefunded,
        totalOutstanding: totals.totalOutstanding,
        status: SettlementStatus.CLOSED,
        closedAt: new Date(),
        closedByUserId: closedByUserId ?? null,
      },
      create: {
        parkingLotId,
        businessDate,
        totalInvoice: totals.totalInvoice,
        totalPaid: totals.totalPaid,
        totalRefunded: totals.totalRefunded,
        totalOutstanding: totals.totalOutstanding,
        status: SettlementStatus.CLOSED,
        closedAt: new Date(),
        closedByUserId: closedByUserId ?? null,
      },
    });
  }

  async listSettlements(query: SettlementListQuery = {}) {
    const parkingLotId = query.parkingLotId || null;
    const year = normalizeYear(query.year);
    const month = normalizeMonth(query.month);

    const rows = await this.prisma.$queryRaw<DailySettlementRow[]>`
      SELECT
        ds.id,
        ds."parkingLotId",
        ds."businessDate",
        ds."totalInvoice",
        ds."totalPaid",
        ds."totalRefunded",
        ds."totalOutstanding",
        ds.status::text AS status,
        ds."closedAt",
        ds."closedByUserId",
        ds."createdAt",
        ds."updatedAt",
        lot.name AS "parkingLotName",
        lot.code AS "parkingLotCode"
      FROM "DailySettlement" ds
      LEFT JOIN "ParkingLot" lot
        ON lot.id = ds."parkingLotId"
      WHERE ds.status::text = 'CLOSED'
        AND (${parkingLotId}::text IS NULL OR ds."parkingLotId" = ${parkingLotId})
        AND (${year}::text IS NULL OR substring(ds."businessDate", 1, 4) = ${year})
        AND (${month}::text IS NULL OR substring(ds."businessDate", 6, 2) = ${month})
      ORDER BY ds."businessDate" DESC, ds."createdAt" DESC
    `;

    return rows.map((row) => ({
      id: row.id,
      parkingLotId: row.parkingLotId,
      businessDate: row.businessDate,
      totalInvoice: Number(row.totalInvoice ?? 0),
      totalPaid: Number(row.totalPaid ?? 0),
      totalRefunded: Number(row.totalRefunded ?? 0),
      totalOutstanding: Number(row.totalOutstanding ?? 0),
      status: row.status,
      closedAt: row.closedAt,
      closedByUserId: row.closedByUserId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      parkingLot: {
        id: row.parkingLotId,
        name: row.parkingLotName,
        code: row.parkingLotCode,
      },
    }));
  }
}
