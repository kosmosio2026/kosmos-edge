import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type SummaryQuery = {
  user?: any;
  region?: string;
  district?: string;
  parkingLotId?: string;
  year?: string;
  month?: string;
};

type FilterOptionQuery = {
  user?: any;
  region?: string;
  district?: string;
};

type ParkingLotRow = {
  id: string;
  name: string | null;
  code: string | null;
  region: string | null;
  district: string | null;
};

type ManagerLotRow = {
  parkingLotId: string;
};

type InvoiceAggRow = {
  totalAmount: bigint | number | string | null;
  totalPaid: bigint | number | string | null;
  totalUnpaid: bigint | number | string | null;
  invoiceCount: bigint | number | string | null;
  paidCount: bigint | number | string | null;
  partiallyPaidCount: bigint | number | string | null;
  cancelledCount: bigint | number | string | null;
};

type PaymentAggRow = {
  totalSuccessAmount: bigint | number | string | null;
  successCount: bigint | number | string | null;
};

type LotBreakdownRow = {
  parkingLotId: string;
  parkingLotName: string | null;
  parkingLotCode: string | null;
  region: string | null;
  district: string | null;
  totalAmount: bigint | number | string | null;
  totalPaid: bigint | number | string | null;
  totalUnpaid: bigint | number | string | null;
  invoiceCount: bigint | number | string | null;
  paidCount: bigint | number | string | null;
};

function toNumber(value: bigint | number | string | null | undefined) {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  return 0;
}

function normalizeOptionalText(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function getCurrentKstYearMonth() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  return {
    year: String(kst.getUTCFullYear()),
    month: String(kst.getUTCMonth() + 1).padStart(2, '0'),
  };
}

function normalizeYear(value?: string) {
  const fallback = getCurrentKstYearMonth().year;

  if (!value) return fallback;
  return /^\d{4}$/.test(value) ? value : fallback;
}

function normalizeMonth(value?: string) {
  const fallback = getCurrentKstYearMonth().month;

  if (!value) return fallback;

  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < 1 || numberValue > 12) {
    return fallback;
  }

  return String(numberValue).padStart(2, '0');
}

function getKstMonthRange(year: string, month: string) {
  const monthNumber = Number(month);
  const nextYear = monthNumber === 12 ? Number(year) + 1 : Number(year);
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;

  const start = new Date(`${year}-${month}-01T00:00:00+09:00`);
  const end = new Date(
    `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+09:00`,
  );

  return { start, end };
}

function getKstTodayRange() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = kst.getUTCFullYear();
  const mm = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(kst.getUTCDate()).padStart(2, '0');

  return {
    start: new Date(`${yyyy}-${mm}-${dd}T00:00:00+09:00`),
    end: new Date(`${yyyy}-${mm}-${dd}T23:59:59.999+09:00`),
  };
}

function getUserId(user: any) {
  return user?.id ?? user?.userId ?? user?.sub ?? null;
}

function getRoleNames(user: any) {
  const roleNames = new Set<string>();

  const addRole = (value: unknown) => {
    if (!value) return;

    if (typeof value === 'string') {
      roleNames.add(value.toUpperCase());
      return;
    }

    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;

      for (const key of ['role', 'name', 'roleName', 'code', 'authority']) {
        const nestedValue = obj[key];

        if (typeof nestedValue === 'string') {
          roleNames.add(nestedValue.toUpperCase());
        }

        if (nestedValue && typeof nestedValue === 'object') {
          const nested = nestedValue as Record<string, unknown>;

          for (const nestedKey of ['name', 'code', 'role', 'roleName']) {
            if (typeof nested[nestedKey] === 'string') {
              roleNames.add(String(nested[nestedKey]).toUpperCase());
            }
          }
        }
      }
    }
  };

  addRole(user?.role);
  addRole(user?.roleName);
  addRole(user?.authority);

  if (Array.isArray(user?.roles)) {
    for (const role of user.roles) {
      addRole(role);
    }
  }

  return roleNames;
}

function hasAdminRole(user: any) {
  const roles = getRoleNames(user);

  return (
    roles.has('ADMIN') ||
    roles.has('SUPERUSER') ||
    roles.has('SYSTEM_ADMIN') ||
    roles.has('TENANT_ADMIN')
  );
}

function hasManagerRole(user: any) {
  const roles = getRoleNames(user);

  return roles.has('MANAGER');
}

function uniqueStrings(values: Array<string | null>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value))),
  ).sort((a, b) => a.localeCompare(b, 'ko-KR'));
}

function emptySummary(year: string, month: string, options: any) {
  return {
    todayRevenue: 0,
    monthRevenue: 0,
    outstanding: {
      totalOpenAmount: 0,
    },
    collections: 0,
    invoiceCount: 0,
    paidCount: 0,
    partiallyPaidCount: 0,
    failedCount: 0,
    invoices: {
      totalAmount: 0,
      totalPaid: 0,
      totalUnpaid: 0,
    },
    payments: {
      totalSuccessAmount: 0,
    },
    filters: {
      year,
      month,
    },
    options,
    lotBreakdown: [],
    generatedAt: new Date().toISOString(),
  };
}

@Injectable()
export class BillingSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  private async getManagerLotIds(userId: string | null) {
    if (!userId) return [];

    const rows = await this.prisma.$queryRaw<ManagerLotRow[]>`
      SELECT mpl."parkingLotId"
      FROM "ManagerParkingLot" mpl
      WHERE mpl."managerProfileUserId" = ${userId}
    `;

    return rows.map((row) => row.parkingLotId);
  }

  private async getAccessibleParkingLots(user: any) {
    const userId = getUserId(user);
    const isAdmin = hasAdminRole(user);
    const isManager = hasManagerRole(user);
    const managerLotIds = await this.getManagerLotIds(userId);

    if (isAdmin) {
      return this.prisma.$queryRaw<ParkingLotRow[]>`
        SELECT
          lot.id,
          lot.name,
          lot.code,
          lot.region,
          lot.district
        FROM "ParkingLot" lot
        WHERE lot."isActive" = true
        ORDER BY lot.name ASC, lot.code ASC
      `;
    }

    if (isManager || managerLotIds.length > 0) {
      if (managerLotIds.length === 0) {
        return [];
      }

      return this.prisma.$queryRaw<ParkingLotRow[]>`
        SELECT
          lot.id,
          lot.name,
          lot.code,
          lot.region,
          lot.district
        FROM "ParkingLot" lot
        WHERE lot."isActive" = true
          AND lot.id = ANY(${managerLotIds}::text[])
        ORDER BY lot.name ASC, lot.code ASC
      `;
    }

    /*
      기존 JWT payload에 role이 없던 경우 admin 화면에서도 목록이 비는 문제가 있었다.
      role 정보가 없고 manager 배정도 없으면 admin/local 운영 콘솔 호환을 위해 전체 활성 주차장을 반환한다.
    */
    return this.prisma.$queryRaw<ParkingLotRow[]>`
      SELECT
        lot.id,
        lot.name,
        lot.code,
        lot.region,
        lot.district
      FROM "ParkingLot" lot
      WHERE lot."isActive" = true
      ORDER BY lot.name ASC, lot.code ASC
    `;
  }

  private filterParkingLots(
    lots: ParkingLotRow[],
    filter: {
      region?: string | null;
      district?: string | null;
      parkingLotId?: string | null;
    },
  ) {
    return lots.filter((lot) => {
      if (filter.region && lot.region !== filter.region) return false;
      if (filter.district && lot.district !== filter.district) return false;
      if (filter.parkingLotId && lot.id !== filter.parkingLotId) return false;
      return true;
    });
  }

  async getFilterOptions(query: FilterOptionQuery = {}) {
    const region = normalizeOptionalText(query.region);
    const district = normalizeOptionalText(query.district);
    const accessibleLots = await this.getAccessibleParkingLots(query.user);

    const regionFilteredLots = this.filterParkingLots(accessibleLots, {
      region,
    });

    const districtFilteredLots = this.filterParkingLots(accessibleLots, {
      region,
      district,
    });

    return {
      regions: uniqueStrings(accessibleLots.map((lot) => lot.region)),
      districts: uniqueStrings(regionFilteredLots.map((lot) => lot.district)),
      parkingLots: districtFilteredLots.map((lot) => ({
        id: lot.id,
        name: lot.name,
        code: lot.code,
        region: lot.region,
        district: lot.district,
      })),
    };
  }

  async getSummary(query: SummaryQuery = {}) {
    const region = normalizeOptionalText(query.region);
    const district = normalizeOptionalText(query.district);
    const parkingLotId = normalizeOptionalText(query.parkingLotId);
    const year = normalizeYear(query.year);
    const month = normalizeMonth(query.month);

    const accessibleLots = await this.getAccessibleParkingLots(query.user);
    const targetLots = this.filterParkingLots(accessibleLots, {
      region,
      district,
      parkingLotId,
    });
    const targetLotIds = targetLots.map((lot) => lot.id);

    const options = await this.getFilterOptions({
      user: query.user,
      region: region ?? undefined,
      district: district ?? undefined,
    });

    if (targetLotIds.length === 0) {
      return {
        ...emptySummary(year, month, options),
        filters: {
          region,
          district,
          parkingLotId,
          year,
          month,
        },
      };
    }

    const { start, end } = getKstMonthRange(year, month);
    const todayRange = getKstTodayRange();

    const [invoiceRows, paymentRows, todayPaymentRows, lotRows] =
      await Promise.all([
        this.prisma.$queryRaw<InvoiceAggRow[]>`
          SELECT
            COALESCE(SUM(invoice.amount), 0) AS "totalAmount",
            COALESCE(SUM(invoice."paidAmount"), 0) AS "totalPaid",
            COALESCE(SUM(invoice."unpaidAmount"), 0) AS "totalUnpaid",
            COUNT(invoice.id)::int AS "invoiceCount",
            COUNT(invoice.id) FILTER (
              WHERE invoice.status::text = 'PAID'
            )::int AS "paidCount",
            COUNT(invoice.id) FILTER (
              WHERE invoice.status::text = 'PARTIALLY_PAID'
            )::int AS "partiallyPaidCount",
            COUNT(invoice.id) FILTER (
              WHERE invoice.status::text IN ('VOID', 'CANCELLED')
            )::int AS "cancelledCount"
          FROM "Invoice" invoice
          INNER JOIN "ParkingSession" session
            ON session.id = invoice."sessionId"
          INNER JOIN "ParkingSpace" space
            ON space.id = session."parkingSpaceId"
          INNER JOIN "ParkingSection" section
            ON section.id = space."sectionId"
          INNER JOIN "ParkingLot" lot
            ON lot.id = section."parkingLotId"
          WHERE invoice."createdAt" >= ${start}
            AND invoice."createdAt" < ${end}
            AND lot.id = ANY(${targetLotIds}::text[])
        `,
        this.prisma.$queryRaw<PaymentAggRow[]>`
          SELECT
            COALESCE(SUM(payment.amount), 0) AS "totalSuccessAmount",
            COUNT(payment.id)::int AS "successCount"
          FROM "Payment" payment
          INNER JOIN "Invoice" invoice
            ON invoice.id = payment."invoiceId"
          INNER JOIN "ParkingSession" session
            ON session.id = invoice."sessionId"
          INNER JOIN "ParkingSpace" space
            ON space.id = session."parkingSpaceId"
          INNER JOIN "ParkingSection" section
            ON section.id = space."sectionId"
          INNER JOIN "ParkingLot" lot
            ON lot.id = section."parkingLotId"
          WHERE payment.status::text = 'SUCCESS'
            AND payment."updatedAt" >= ${start}
            AND payment."updatedAt" < ${end}
            AND lot.id = ANY(${targetLotIds}::text[])
        `,
        this.prisma.$queryRaw<PaymentAggRow[]>`
          SELECT
            COALESCE(SUM(payment.amount), 0) AS "totalSuccessAmount",
            COUNT(payment.id)::int AS "successCount"
          FROM "Payment" payment
          INNER JOIN "Invoice" invoice
            ON invoice.id = payment."invoiceId"
          INNER JOIN "ParkingSession" session
            ON session.id = invoice."sessionId"
          INNER JOIN "ParkingSpace" space
            ON space.id = session."parkingSpaceId"
          INNER JOIN "ParkingSection" section
            ON section.id = space."sectionId"
          INNER JOIN "ParkingLot" lot
            ON lot.id = section."parkingLotId"
          WHERE payment.status::text = 'SUCCESS'
            AND payment."updatedAt" >= ${todayRange.start}
            AND payment."updatedAt" <= ${todayRange.end}
            AND lot.id = ANY(${targetLotIds}::text[])
        `,
        this.prisma.$queryRaw<LotBreakdownRow[]>`
          SELECT
            lot.id AS "parkingLotId",
            lot.name AS "parkingLotName",
            lot.code AS "parkingLotCode",
            lot.region,
            lot.district,
            COALESCE(SUM(invoice.amount), 0) AS "totalAmount",
            COALESCE(SUM(invoice."paidAmount"), 0) AS "totalPaid",
            COALESCE(SUM(invoice."unpaidAmount"), 0) AS "totalUnpaid",
            COUNT(invoice.id)::int AS "invoiceCount",
            COUNT(invoice.id) FILTER (
              WHERE invoice.status::text = 'PAID'
            )::int AS "paidCount"
          FROM "ParkingLot" lot
          LEFT JOIN "ParkingSection" section
            ON section."parkingLotId" = lot.id
          LEFT JOIN "ParkingSpace" space
            ON space."sectionId" = section.id
          LEFT JOIN "ParkingSession" session
            ON session."parkingSpaceId" = space.id
          LEFT JOIN "Invoice" invoice
            ON invoice."sessionId" = session.id
           AND invoice."createdAt" >= ${start}
           AND invoice."createdAt" < ${end}
          WHERE lot.id = ANY(${targetLotIds}::text[])
          GROUP BY lot.id, lot.name, lot.code, lot.region, lot.district
          ORDER BY "totalPaid" DESC, lot.name ASC, lot.code ASC
        `,
      ]);

    const invoiceAgg = invoiceRows[0] ?? null;
    const paymentAgg = paymentRows[0] ?? null;
    const todayPaymentAgg = todayPaymentRows[0] ?? null;

    const totalAmount = toNumber(invoiceAgg?.totalAmount);
    const totalPaid = toNumber(invoiceAgg?.totalPaid);
    const totalUnpaid = toNumber(invoiceAgg?.totalUnpaid);
    const totalSuccessAmount = toNumber(paymentAgg?.totalSuccessAmount);
    const todayRevenue = toNumber(todayPaymentAgg?.totalSuccessAmount);

    return {
      todayRevenue,
      monthRevenue: totalPaid,
      outstanding: {
        totalOpenAmount: totalUnpaid,
      },
      collections: totalPaid,
      invoiceCount: toNumber(invoiceAgg?.invoiceCount),
      paidCount: toNumber(invoiceAgg?.paidCount),
      partiallyPaidCount: toNumber(invoiceAgg?.partiallyPaidCount),
      failedCount: toNumber(invoiceAgg?.cancelledCount),
      invoices: {
        totalAmount,
        totalPaid,
        totalUnpaid,
      },
      payments: {
        totalSuccessAmount,
      },
      filters: {
        region,
        district,
        parkingLotId,
        year,
        month,
      },
      options,
      lotBreakdown: lotRows.map((row) => ({
        parkingLotId: row.parkingLotId,
        parkingLotName: row.parkingLotName,
        parkingLotCode: row.parkingLotCode,
        region: row.region,
        district: row.district,
        totalAmount: toNumber(row.totalAmount),
        totalPaid: toNumber(row.totalPaid),
        totalUnpaid: toNumber(row.totalUnpaid),
        invoiceCount: toNumber(row.invoiceCount),
        paidCount: toNumber(row.paidCount),
      })),
      generatedAt: new Date().toISOString(),
    };
  }
}
