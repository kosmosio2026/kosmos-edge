import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type TenantAuthUser = {
  id?: string;
  sub?: string;
  email?: string | null;
  role?: string | null;
  roles?: Array<string | { code?: string | null; role?: { code?: string | null } }>;
  tenantId?: string | null;
  managementCompanyId?: string | null;
};

type VisitSessionRow = {
  id: string;
  status: string;
  parkingSpaceId: string | null;
  plateNumber: string | null;
  contactPhone: string | null;
  entryTime: Date | null;
  exitTime: Date | null;
  amount: number | null;
  paidAmount: number | null;
  unpaidAmount: number | null;
  parkingLotId: string | null;
  parkingLotName: string | null;
  parkingLotCode: string | null;
  parkingLotManagementCompanyId: string | null;
  parkingSectionId: string | null;
  parkingSpaceCode: string | null;
  parkingSpaceStatus: string | null;
  graceMinutes: number | null;
};

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  private getUserId(user: TenantAuthUser | undefined) {
    return user?.sub ?? user?.id ?? null;
  }

  private getRoleCodes(user: TenantAuthUser | undefined) {
    const roleCodes = new Set<string>();

    if (user?.role) {
      roleCodes.add(String(user.role).toUpperCase());
    }

    for (const item of user?.roles ?? []) {
      if (typeof item === 'string') {
        roleCodes.add(item.toUpperCase());
        continue;
      }

      if (item?.code) {
        roleCodes.add(String(item.code).toUpperCase());
      }

      if (item?.role?.code) {
        roleCodes.add(String(item.role.code).toUpperCase());
      }
    }

    return roleCodes;
  }

  private isAdmin(user: TenantAuthUser | undefined) {
    const roles = this.getRoleCodes(user);

    return (
      roles.has('ADMIN') ||
      roles.has('SUPER_ADMIN') ||
      roles.has('SUPERUSER') ||
      roles.has('ROOT')
    );
  }

  private async getDbUserContext(user: TenantAuthUser | undefined) {
    const userId = this.getUserId(user);

    if (!userId) {
      return {
        userId: null,
        managementCompanyId: user?.managementCompanyId ?? user?.tenantId ?? null,
        isAdmin: this.isAdmin(user),
      };
    }

    const dbUser = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        tenantId: true,
        managementCompanyId: true,
        roles: {
          include: {
            role: {
              select: {
                code: true,
              },
            },
          },
        },
        managerProfile: {
          select: {
            managementCompanyId: true,
          },
        },
      },
    });

    const dbRoleCodes = new Set(this.getRoleCodes(user));

    for (const userRole of dbUser?.roles ?? []) {
      const code = userRole.role?.code;
      if (code) {
        dbRoleCodes.add(code.toUpperCase());
      }
    }

    const isAdmin =
      this.isAdmin(user) ||
      dbRoleCodes.has('ADMIN') ||
      dbRoleCodes.has('SUPER_ADMIN') ||
      dbRoleCodes.has('SUPERUSER') ||
      dbRoleCodes.has('ROOT');

    return {
      userId,
      isAdmin,
      managementCompanyId:
        user?.managementCompanyId ??
        dbUser?.managerProfile?.managementCompanyId ??
        dbUser?.managementCompanyId ??
        user?.tenantId ??
        dbUser?.tenantId ??
        null,
    };
  }

  private async getAccessibleParkingLotIds(user: TenantAuthUser | undefined) {
    const context = await this.getDbUserContext(user);

    if (context.isAdmin) {
      return null;
    }

    if (!context.userId && !context.managementCompanyId) {
      return [];
    }

    const whereOr: any[] = [];

    if (context.managementCompanyId) {
      whereOr.push({
        managementCompanyId: context.managementCompanyId,
      });
    }

    if (context.userId) {
      whereOr.push({
        ManagerParkingLot: {
          some: {
            managerProfileUserId: context.userId,
          },
        },
      });
    }

    if (whereOr.length === 0) {
      return [];
    }

    const lots = await this.prisma.parkingLot.findMany({
      where: {
        OR: whereOr,
      },
      select: {
        id: true,
      },
    });

    return lots.map((lot) => lot.id);
  }

  private async buildTenantWhere(user: TenantAuthUser | undefined, tenantId?: string) {
    const context = await this.getDbUserContext(user);
    const lotIds = await this.getAccessibleParkingLotIds(user);

    const andConditions: any[] = [
      {
        parkingLotId: {
          not: null,
        },
      },
    ];

    if (tenantId) {
      andConditions.push({
        id: tenantId,
      });
    }

    if (!context.isAdmin) {
      const accessOr: any[] = [];

      if (lotIds && lotIds.length > 0) {
        accessOr.push({
          parkingLotId: {
            in: lotIds,
          },
        });
      }

      if (context.userId) {
        accessOr.push({
          tenantUsers: {
            some: {
              userId: context.userId,
              status: 'ACTIVE',
            },
          },
        });
      }

      if (accessOr.length === 0) {
        andConditions.push({
          id: '__NO_ACCESS__',
        });
      } else {
        andConditions.push({
          OR: accessOr,
        });
      }
    }

    return {
      AND: andConditions,
    };
  }

  private mapTenant(tenant: any) {
    const legacyParkingLots = tenant._count?.parkingLots ?? 0;
    const visitParkingLotCount = tenant.parkingLotId ? 1 : 0;

    return {
      id: tenant.id,
      name: tenant.name,
      code: tenant.code,

      managementCompanyId: tenant.managementCompanyId ?? null,
      managementCompanyName: tenant.managementCompany?.name ?? null,

      parkingLotId: tenant.parkingLotId ?? null,
      parkingLotName: tenant.parkingLot?.name ?? null,
      parkingLotCode: tenant.parkingLot?.code ?? null,

      representative: tenant.representative ?? null,
      contact: tenant.contact ?? null,
      billingEmail: tenant.billingEmail ?? null,
      isActive: tenant.isActive ?? true,

      tenantUsers: tenant._count?.tenantUsers ?? 0,
      parkingLots: visitParkingLotCount || legacyParkingLots,
      charges: tenant._count?.charges ?? 0,
      monthlyStatements: tenant._count?.monthlyStatements ?? 0,
      visitConfirmations: tenant._count?.visitConfirmations ?? 0,

      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  private getBillingMonthKst(date: Date) {
    const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    const year = kst.getUTCFullYear();
    const month = String(kst.getUTCMonth() + 1).padStart(2, '0');

    return `${year}-${month}`;
  }

  private async getVisitSession(parkingSessionId: string) {
    const rows = await this.prisma.$queryRaw<VisitSessionRow[]>`
      SELECT
        ps."id",
        ps."status",
        ps."parkingSpaceId",
        ps."plateNumber",
        ps."contactPhone",
        ps."entryTime",
        ps."exitTime",
        ps."amount",
        ps."paidAmount",
        ps."unpaidAmount",
        pl."id" AS "parkingLotId",
        pl."name" AS "parkingLotName",
        pl."code" AS "parkingLotCode",
        pl."managementCompanyId" AS "parkingLotManagementCompanyId",
        sec."id" AS "parkingSectionId",
        space."code" AS "parkingSpaceCode",
        space."status" AS "parkingSpaceStatus",
        pl."graceMinutes"
      FROM "ParkingSession" ps
      LEFT JOIN "ParkingSpace" space ON space."id" = ps."parkingSpaceId"
      LEFT JOIN "ParkingSection" sec ON sec."id" = space."sectionId"
      LEFT JOIN "ParkingLot" pl ON pl."id" = sec."parkingLotId"
      WHERE ps."id" = ${parkingSessionId}
      LIMIT 1
    `;

    return rows[0] ?? null;
  }

  async findAll(user?: TenantAuthUser) {
    const where = await this.buildTenantWhere(user);

    const tenants = await this.prisma.tenant.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        managementCompany: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        parkingLot: {
          select: {
            id: true,
            name: true,
            code: true,
            region: true,
            district: true,
            address: true,
          },
        },
        _count: {
          select: {
            tenantUsers: true,
            visitConfirmations: true,
            charges: true,
            monthlyStatements: true,
          },
        },
      },
    });

    return tenants.map((tenant) => this.mapTenant(tenant));
  }

  async findOne(tenantId: string, user?: TenantAuthUser) {
    const where = await this.buildTenantWhere(user, tenantId);

    const tenant = await this.prisma.tenant.findFirst({
      where,
      include: {
        managementCompany: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        parkingLot: {
          select: {
            id: true,
            name: true,
            code: true,
            region: true,
            district: true,
            address: true,
          },
        },
        _count: {
          select: {
            tenantUsers: true,
            visitConfirmations: true,
            charges: true,
            monthlyStatements: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    return this.mapTenant(tenant);
  }

  async findParkingLots(tenantId: string, user?: TenantAuthUser) {
    const where = await this.buildTenantWhere(user, tenantId);

    const tenant = await this.prisma.tenant.findFirst({
      where,
      include: {
        parkingLot: {
          include: {
            _count: {
              select: {
                sections: true,
              },
            },
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    if (tenant.parkingLot) {
      const lot = tenant.parkingLot;

      return [
        {
          id: lot.id,
          name: lot.name,
          code: lot.code,
          region: lot.region,
          address: lot.address,
          district: lot.district,
          isActive: lot.isActive,
          sections: lot._count.sections,
          createdAt: lot.createdAt,
          updatedAt: lot.updatedAt,
        },
      ];
    }

    return [];
  }

  async findUsers(tenantId: string, user?: TenantAuthUser) {
    const where = await this.buildTenantWhere(user, tenantId);

    const tenant = await this.prisma.tenant.findFirst({
      where,
      select: {
        id: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }

    const tenantUsers = await this.prisma.tenantUser.findMany({
      where: {
        tenantId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: true,
      },
    });

    return tenantUsers.map((tenantUser) => {
      const user = tenantUser.user as any;

      return {
        id: tenantUser.id,
        tenantId: tenantUser.tenantId,
        userId: tenantUser.userId,
        role: tenantUser.role,
        status: tenantUser.status,
        name: user?.name ?? user?.fullName ?? '-',
        email: user?.email ?? '-',
        phone: user?.phone ?? user?.phoneNumber ?? '-',
        userCreatedAt: user?.createdAt ?? null,
        createdAt: tenantUser.createdAt,
        updatedAt: tenantUser.updatedAt,
      };
    });
  }

  async confirmVisit(
    tenantId: string,
    parkingSessionId: string,
    body: { note?: string } | undefined,
    user?: TenantAuthUser,
  ) {
    const context = await this.getDbUserContext(user);
    const where = await this.buildTenantWhere(user, tenantId);

    const tenant = await this.prisma.tenant.findFirst({
      where,
      include: {
        parkingLot: {
          select: {
            id: true,
            name: true,
            code: true,
            graceMinutes: true,
            managementCompanyId: true,
          },
        },
        managementCompany: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!tenant || !tenant.parkingLotId || !tenant.parkingLot) {
      throw new NotFoundException('Tenant not found.');
    }

    const tenantParkingLotId = tenant.parkingLotId;
    const tenantParkingLot = tenant.parkingLot;

    if (!context.isAdmin && !context.userId) {
      throw new ForbiddenException('User is required.');
    }

    const session = await this.getVisitSession(parkingSessionId);

    if (!session) {
      throw new NotFoundException('Parking session not found.');
    }

    if (!session.parkingLotId) {
      throw new BadRequestException('Parking session is not connected to a parking lot.');
    }

    if (session.parkingLotId !== tenantParkingLotId) {
      throw new ForbiddenException('Parking session does not belong to this tenant parking lot.');
    }

    if (session.exitTime) {
      throw new BadRequestException('Cannot confirm a session that already exited.');
    }

    if (['CLOSED', 'CANCELLED', 'LOST'].includes(String(session.status).toUpperCase())) {
      throw new BadRequestException(`Cannot confirm session with status ${session.status}.`);
    }

    const confirmedAt = new Date();
    const graceMinutes = tenantParkingLot.graceMinutes ?? session.graceMinutes ?? 10;
    const graceUntil = new Date(confirmedAt.getTime() + graceMinutes * 60 * 1000);
    const billingMonth = this.getBillingMonthKst(confirmedAt);

    const previousPaidAmount = Math.max(Number(session.paidAmount ?? 0), 0);
    const currentUnpaidAmount = Math.max(Number(session.unpaidAmount ?? session.amount ?? 0), 0);
    const sessionAmount = Math.max(
      Number(session.amount ?? previousPaidAmount + currentUnpaidAmount),
      0,
    );

    const coveredAmount = currentUnpaidAmount;
    const nextPaidAmount = Math.max(
      previousPaidAmount,
      Math.min(sessionAmount, previousPaidAmount + coveredAmount),
    );

    const managementCompanyId =
      tenant.managementCompanyId ??
      tenantParkingLot.managementCompanyId ??
      session.parkingLotManagementCompanyId;

    if (!managementCompanyId) {
      throw new BadRequestException('Tenant management company is not configured.');
    }

    const confirmedByUserId = context.userId;

    if (!confirmedByUserId) {
      throw new ForbiddenException('Confirmed user is required.');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const closedStatement = await tx.tenantMonthlyStatement.findFirst({
        where: {
          tenantId,
          billingMonth,
          status: {
            in: ['CLOSED', 'INVOICED', 'PAID'] as any,
          },
        },
        select: {
          id: true,
          status: true,
          billingMonth: true,
        },
      });

      if (closedStatement) {
        throw new BadRequestException(
          'Closed tenant billing month cannot be modified.',
        );
      }

      await tx.parkingSession.update({
        where: {
          id: parkingSessionId,
        },
        data: {
          status: 'PAID',
          visitTenantId: tenant.id,
          tenantConfirmedAt: confirmedAt,
          tenantGraceUntil: graceUntil,
          tenantCoveredAmount: coveredAmount,
          tenantVisitConfirmedBy: confirmedByUserId,
          paidAmount: nextPaidAmount,
          unpaidAmount: 0,
        },
      });

      const confirmation = await tx.tenantVisitConfirmation.upsert({
        where: {
          parkingSessionId_tenantId: {
            parkingSessionId,
            tenantId: tenant.id,
          },
        },
        update: {
          confirmedByUserId,
          confirmedAt,
          vehiclePlate: session.plateNumber,
          contactPhone: session.contactPhone,
          entryTime: session.entryTime,
          coveredAmount,
          coveredUntil: confirmedAt,
          graceMinutes,
          graceUntil,
          note: body?.note ?? null,
          status: 'CONFIRMED',
        },
        create: {
          tenantId: tenant.id,
          parkingSessionId,
          parkingLotId: tenantParkingLotId,
          parkingSectionId: session.parkingSectionId,
          parkingSpaceId: session.parkingSpaceId,
          confirmedByUserId,
          confirmedAt,
          vehiclePlate: session.plateNumber,
          contactPhone: session.contactPhone,
          entryTime: session.entryTime,
          coveredAmount,
          coveredUntil: confirmedAt,
          graceMinutes,
          graceUntil,
          note: body?.note ?? null,
          status: 'CONFIRMED',
        },
      });

      const existingCharge = await tx.tenantCharge.findFirst({
        where: {
          tenantVisitConfirmationId: confirmation.id,
        },
      });

      let amountDelta = coveredAmount;
      let visitCountDelta = 1;

      let charge;

      if (existingCharge) {
        amountDelta = coveredAmount - existingCharge.amount;
        visitCountDelta = 0;

        charge = await tx.tenantCharge.update({
          where: {
            id: existingCharge.id,
          },
          data: {
            amount: coveredAmount,
            occurredAt: confirmedAt,
            billingMonth,
            status: 'PENDING',
            memo: body?.note ?? null,
          },
        });
      } else {
        charge = await tx.tenantCharge.create({
          data: {
            tenantId: tenant.id,
            parkingSessionId,
            tenantVisitConfirmationId: confirmation.id,
            parkingLotId: tenantParkingLotId,
            parkingSpaceId: session.parkingSpaceId,
            chargeType: 'VISIT_PARKING_FEE',
            amount: coveredAmount,
            occurredAt: confirmedAt,
            billingMonth,
            status: 'PENDING',
            memo: body?.note ?? null,
          },
        });
      }

      const statement = await tx.tenantMonthlyStatement.upsert({
        where: {
          tenantId_billingMonth: {
            tenantId: tenant.id,
            billingMonth,
          },
        },
        update: {
          totalAmount: {
            increment: amountDelta,
          },
          visitCount: {
            increment: visitCountDelta,
          },
        },
        create: {
          tenantId: tenant.id,
          parkingLotId: tenantParkingLotId,
          managementCompanyId,
          billingMonth,
          totalAmount: coveredAmount,
          visitCount: 1,
          status: 'DRAFT',
        },
      });

      await tx.parkingSessionEvent.create({
        data: {
          sessionId: parkingSessionId,
          type: 'TENANT_VISIT_CONFIRMED',
          source: 'TENANT',
          payload: {
            tenantId: tenant.id,
            tenantName: tenant.name,
            parkingLotId: tenantParkingLotId,
            confirmedByUserId,
            confirmedAt: confirmedAt.toISOString(),
            graceUntil: graceUntil.toISOString(),
            coveredAmount,
            chargeId: charge.id,
            statementId: statement.id,
          },
        },
      });

      return {
        confirmation,
        charge,
        statement,
      };
    });

    return {
      ok: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        code: tenant.code,
      },
      parkingLot: {
        id: tenantParkingLot.id,
        name: tenantParkingLot.name,
        code: tenantParkingLot.code,
      },
      session: {
        id: parkingSessionId,
        status: 'PAID',
        exitTime: null,
        parkingSpaceId: session.parkingSpaceId,
        parkingSpaceCode: session.parkingSpaceCode,
        previousStatus: session.status,
      },
      confirmation: {
        id: result.confirmation.id,
        confirmedAt: result.confirmation.confirmedAt,
        coveredAmount: result.confirmation.coveredAmount,
        graceMinutes: result.confirmation.graceMinutes,
        graceUntil: result.confirmation.graceUntil,
      },
      charge: {
        id: result.charge.id,
        amount: result.charge.amount,
        billingMonth: result.charge.billingMonth,
        status: result.charge.status,
      },
      statement: {
        id: result.statement.id,
        billingMonth: result.statement.billingMonth,
        totalAmount: result.statement.totalAmount,
        visitCount: result.statement.visitCount,
        status: result.statement.status,
      },
    };
  }

  private getBillingUserId(user?: any) {
    return String(user?.sub ?? user?.userId ?? user?.id ?? '').trim() || null;
  }

  private getBillingUserRoles(user?: any) {
    const raw = user?.roles ?? user?.role ?? [];
    if (Array.isArray(raw)) return raw.map(String);
    if (raw) return [String(raw)];
    return [];
  }

  private isBillingAdmin(user?: any) {
    return this.getBillingUserRoles(user).includes('ADMIN');
  }

  private isBillingManager(user?: any) {
    return this.getBillingUserRoles(user).includes('MANAGER');
  }

  private async assertTenantBillingAccess(tenantId: string, user?: any) {
    const tenant = await this.prisma.tenant.findUnique({
      where: {
        id: tenantId,
      },
      select: {
        id: true,
        name: true,
        code: true,
        parkingLotId: true,
        managementCompanyId: true,
        parkingLot: {
          select: {
            id: true,
            name: true,
            code: true,
            managementCompanyId: true,
          },
        },
        managementCompany: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!tenant || !tenant.parkingLotId) {
      throw new NotFoundException('Tenant not found.');
    }

    if (this.isBillingAdmin(user)) {
      return tenant;
    }

    const userId = this.getBillingUserId(user);
    if (!userId) {
      throw new ForbiddenException('No permission to access tenant billing.');
    }

    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: {
        tenantId,
        userId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
      },
    });

    if (tenantUser) {
      return tenant;
    }

    if (this.isBillingManager(user)) {
      const [userRow, managerProfile, managerLot] = await Promise.all([
        this.prisma.user.findUnique({
          where: {
            id: userId,
          },
          select: {
            managementCompanyId: true,
          },
        }),
        this.prisma.managerProfile.findFirst({
          where: {
            userId,
          },
          select: {
            managementCompanyId: true,
          },
        }),
        tenant.parkingLotId
          ? this.prisma.managerParkingLot.findFirst({
              where: {
                managerProfileUserId: userId,
                parkingLotId: tenant.parkingLotId,
              },
              select: {
                id: true,
              },
            })
          : Promise.resolve(null),
      ]);

      const userManagementCompanyId =
        userRow?.managementCompanyId ?? managerProfile?.managementCompanyId ?? null;

      const tenantManagementCompanyId =
        tenant.managementCompanyId ?? tenant.parkingLot?.managementCompanyId ?? null;

      if (
        managerLot ||
        (userManagementCompanyId &&
          tenantManagementCompanyId &&
          userManagementCompanyId === tenantManagementCompanyId)
      ) {
        return tenant;
      }
    }

    throw new ForbiddenException('No permission to access tenant billing.');
  }

  private normalizeBillingMonth(value?: string | null) {
    const month = String(value ?? '').trim();
    if (!month) return null;

    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('billingMonth must be YYYY-MM.');
    }

    return month;
  }

  async findTenantStatements(
    tenantId: string,
    user?: any,
    query?: {
      billingMonth?: string | null;
      status?: string | null;
    },
  ) {
    await this.assertTenantBillingAccess(tenantId, user);

    const billingMonth = this.normalizeBillingMonth(query?.billingMonth);
    const status = String(query?.status ?? '').trim().toUpperCase() || null;

    const statements = await this.prisma.tenantMonthlyStatement.findMany({
      where: {
        tenantId,
        ...(billingMonth ? { billingMonth } : {}),
        ...(status ? { status: status as any } : {}),
      },
      orderBy: [
        {
          billingMonth: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });

    return statements.map((statement) => ({
      id: statement.id,
      tenantId: statement.tenantId,
      parkingLotId: statement.parkingLotId,
      managementCompanyId: statement.managementCompanyId,
      billingMonth: statement.billingMonth,
      totalAmount: statement.totalAmount,
      visitCount: statement.visitCount,
      status: statement.status,
      closedAt: statement.closedAt,
      closedByUserId: statement.closedByUserId,
      memo: statement.memo,
      createdAt: statement.createdAt,
      updatedAt: statement.updatedAt,
    }));
  }

  async findTenantCharges(
    tenantId: string,
    user?: any,
    query?: {
      billingMonth?: string | null;
      status?: string | null;
    },
  ) {
    await this.assertTenantBillingAccess(tenantId, user);

    const billingMonth = this.normalizeBillingMonth(query?.billingMonth);
    const status = String(query?.status ?? '').trim().toUpperCase() || null;

    const charges = await this.prisma.tenantCharge.findMany({
      where: {
        tenantId,
        ...(billingMonth ? { billingMonth } : {}),
        ...(status ? { status: status as any } : {}),
      },
      orderBy: [
        {
          occurredAt: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });

    return charges.map((charge) => ({
      id: charge.id,
      tenantId: charge.tenantId,
      parkingSessionId: charge.parkingSessionId,
      tenantVisitConfirmationId: charge.tenantVisitConfirmationId,
      parkingLotId: charge.parkingLotId,
      parkingSpaceId: charge.parkingSpaceId,
      chargeType: charge.chargeType,
      amount: charge.amount,
      occurredAt: charge.occurredAt,
      billingMonth: charge.billingMonth,
      status: charge.status,
      memo: charge.memo,
      createdAt: charge.createdAt,
      updatedAt: charge.updatedAt,
    }));
  }

  async closeTenantStatement(
    tenantId: string,
    statementId: string,
    user?: any,
    body?: {
      memo?: string | null;
    },
  ) {
    const tenant = await this.assertTenantBillingAccess(tenantId, user);

    if (!this.isBillingAdmin(user) && !this.isBillingManager(user)) {
      throw new ForbiddenException('Only admin or manager can close tenant statements.');
    }

    const userId = this.getBillingUserId(user);
    if (!userId) {
      throw new ForbiddenException('No authenticated user.');
    }

    const statement = await this.prisma.tenantMonthlyStatement.findFirst({
      where: {
        id: statementId,
        tenantId,
      },
    });

    if (!statement) {
      throw new NotFoundException('Tenant statement not found.');
    }

    if (statement.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT statements can be closed.');
    }

    const now = new Date();
    const memo = String(body?.memo ?? '').trim() || statement.memo;

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedStatement = await tx.tenantMonthlyStatement.update({
        where: {
          id: statement.id,
        },
        data: {
          status: 'CLOSED' as any,
          closedAt: now,
          closedByUserId: userId,
          memo,
        },
      });

      await tx.tenantCharge.updateMany({
        where: {
          tenantId,
          billingMonth: statement.billingMonth,
          status: {
            not: 'CANCELLED' as any,
          },
        },
        data: {
          status: 'STATEMENT_CLOSED' as any,
        },
      });

      return updatedStatement;
    });

    return {
      ok: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        code: tenant.code,
      },
      statement: {
        id: result.id,
        billingMonth: result.billingMonth,
        totalAmount: result.totalAmount,
        visitCount: result.visitCount,
        status: result.status,
        closedAt: result.closedAt,
        closedByUserId: result.closedByUserId,
        memo: result.memo,
      },
    };
  }


  private async getTenantBillingListScope(user?: any) {
    if (this.isBillingAdmin(user)) {
      return {
        isAdmin: true,
        tenantIds: [] as string[],
        parkingLotIds: [] as string[],
        managementCompanyId: null as string | null,
      };
    }

    const userId = this.getBillingUserId(user);
    if (!userId) {
      throw new ForbiddenException('No permission to access tenant billing.');
    }

    const [tenantUsers, directLots, userRow, managerProfile] = await Promise.all([
      this.prisma.tenantUser.findMany({
        where: {
          userId,
          status: 'ACTIVE',
        },
        select: {
          tenantId: true,
        },
      }),
      this.isBillingManager(user)
        ? this.prisma.managerParkingLot.findMany({
            where: {
              managerProfileUserId: userId,
            },
            select: {
              parkingLotId: true,
            },
          })
        : Promise.resolve([]),
      this.prisma.user.findUnique({
        where: {
          id: userId,
        },
        select: {
          managementCompanyId: true,
        },
      }),
      this.isBillingManager(user)
        ? this.prisma.managerProfile.findFirst({
            where: {
              userId,
            },
            select: {
              managementCompanyId: true,
            },
          })
        : Promise.resolve(null),
    ]);

    return {
      isAdmin: false,
      tenantIds: tenantUsers.map((row) => row.tenantId),
      parkingLotIds: directLots.map((row) => row.parkingLotId),
      managementCompanyId:
        userRow?.managementCompanyId ?? managerProfile?.managementCompanyId ?? null,
    };
  }

  private buildTenantBillingScopeWhere(scope: {
    isAdmin: boolean;
    tenantIds: string[];
    parkingLotIds: string[];
    managementCompanyId: string | null;
  }) {
    if (scope.isAdmin) return {};

    const or: any[] = [];

    if (scope.tenantIds.length > 0) {
      or.push({
        tenantId: {
          in: scope.tenantIds,
        },
      });
    }

    if (scope.parkingLotIds.length > 0) {
      or.push({
        parkingLotId: {
          in: scope.parkingLotIds,
        },
      });
    }

    if (scope.managementCompanyId) {
      or.push({
        managementCompanyId: scope.managementCompanyId,
      });
    }

    if (or.length === 0) {
      return {
        id: '__NO_TENANT_BILLING_SCOPE__',
      };
    }

    return {
      OR: or,
    };
  }

  private buildTenantBillingChargeScopeWhere(scope: {
    isAdmin: boolean;
    tenantIds: string[];
    parkingLotIds: string[];
    managementCompanyId: string | null;
  }) {
    if (scope.isAdmin) return {};

    const or: any[] = [];

    if (scope.tenantIds.length > 0) {
      or.push({
        tenantId: {
          in: scope.tenantIds,
        },
      });
    }

    if (scope.parkingLotIds.length > 0) {
      or.push({
        parkingLotId: {
          in: scope.parkingLotIds,
        },
      });
    }

    if (scope.managementCompanyId) {
      or.push({
        tenant: {
          is: {
            managementCompanyId: scope.managementCompanyId,
          },
        },
      });

      or.push({
        parkingLot: {
          is: {
            managementCompanyId: scope.managementCompanyId,
          },
        },
      });
    }

    if (or.length === 0) {
      return {
        id: '__NO_TENANT_BILLING_CHARGE_SCOPE__',
      };
    }

    return {
      OR: or,
    };
  }

  async findBillingStatements(
    user?: any,
    query?: {
      billingMonth?: string | null;
      status?: string | null;
      tenantId?: string | null;
      parkingLotId?: string | null;
    },
  ) {
    const scope = await this.getTenantBillingListScope(user);
    const billingMonth = this.normalizeBillingMonth(query?.billingMonth);
    const status = String(query?.status ?? '').trim().toUpperCase() || null;
    const tenantId = String(query?.tenantId ?? '').trim() || null;
    const parkingLotId = String(query?.parkingLotId ?? '').trim() || null;

    const statements = await this.prisma.tenantMonthlyStatement.findMany({
      where: {
        ...this.buildTenantBillingScopeWhere(scope),
        ...(billingMonth ? { billingMonth } : {}),
        ...(status ? { status: status as any } : {}),
        ...(tenantId ? { tenantId } : {}),
        ...(parkingLotId ? { parkingLotId } : {}),
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            code: true,
            businessNumber: true,
            representative: true,
            contact: true,
          },
        },
        parkingLot: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        managementCompany: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: [
        {
          billingMonth: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
      take: 300,
    });

    return statements.map((statement) => ({
      id: statement.id,
      tenantId: statement.tenantId,
      tenantName: statement.tenant?.name ?? null,
      tenantCode: statement.tenant?.code ?? null,
      tenantBusinessNumber: statement.tenant?.businessNumber ?? null,
      tenantRepresentative: statement.tenant?.representative ?? null,
      tenantContact: statement.tenant?.contact ?? null,
      parkingLotId: statement.parkingLotId,
      parkingLotName: statement.parkingLot?.name ?? null,
      parkingLotCode: statement.parkingLot?.code ?? null,
      managementCompanyId: statement.managementCompanyId,
      managementCompanyName: statement.managementCompany?.name ?? null,
      managementCompanyCode: statement.managementCompany?.code ?? null,
      billingMonth: statement.billingMonth,
      totalAmount: statement.totalAmount,
      visitCount: statement.visitCount,
      status: statement.status,
      closedAt: statement.closedAt,
      closedByUserId: statement.closedByUserId,
      closedByName: null,
      closedByEmail: null,
      memo: statement.memo,
      createdAt: statement.createdAt,
      updatedAt: statement.updatedAt,
    }));
  }

  async findBillingCharges(
    user?: any,
    query?: {
      billingMonth?: string | null;
      status?: string | null;
      tenantId?: string | null;
      parkingLotId?: string | null;
    },
  ) {
    const scope = await this.getTenantBillingListScope(user);
    const billingMonth = this.normalizeBillingMonth(query?.billingMonth);
    const status = String(query?.status ?? '').trim().toUpperCase() || null;
    const tenantId = String(query?.tenantId ?? '').trim() || null;
    const parkingLotId = String(query?.parkingLotId ?? '').trim() || null;

    const charges = await this.prisma.tenantCharge.findMany({
      where: {
        ...this.buildTenantBillingChargeScopeWhere(scope),
        ...(billingMonth ? { billingMonth } : {}),
        ...(status ? { status: status as any } : {}),
        ...(tenantId ? { tenantId } : {}),
        ...(parkingLotId ? { parkingLotId } : {}),
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        parkingLot: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        parkingSpace: {
          select: {
            id: true,
            code: true,
            number: true,
          },
        },
        parkingSession: {
          select: {
            id: true,
            sessionNo: true,
            plateNumber: true,
            contactPhone: true,
            entryTime: true,
            exitTime: true,
            status: true,
          },
        },
      },
      orderBy: [
        {
          occurredAt: 'desc',
        },
        {
          createdAt: 'desc',
        },
      ],
      take: 500,
    });

    return charges.map((charge) => ({
      id: charge.id,
      tenantId: charge.tenantId,
      tenantName: charge.tenant?.name ?? null,
      tenantCode: charge.tenant?.code ?? null,
      parkingSessionId: charge.parkingSessionId,
      sessionNo: charge.parkingSession?.sessionNo ?? null,
      plateNumber: charge.parkingSession?.plateNumber ?? null,
      driverName: null,
      phone: (charge as any).parkingSession?.contactPhone ?? null,
      sessionStatus: charge.parkingSession?.status ?? null,
      entryTime: charge.parkingSession?.entryTime ?? null,
      exitTime: charge.parkingSession?.exitTime ?? null,
      tenantVisitConfirmationId: charge.tenantVisitConfirmationId,
      parkingLotId: charge.parkingLotId,
      parkingLotName: charge.parkingLot?.name ?? null,
      parkingLotCode: charge.parkingLot?.code ?? null,
      parkingSpaceId: charge.parkingSpaceId,
      parkingSpaceCode: charge.parkingSpace?.code ?? null,
      parkingSpaceNumber: charge.parkingSpace?.number ?? null,
      chargeType: charge.chargeType,
      amount: charge.amount,
      occurredAt: charge.occurredAt,
      billingMonth: charge.billingMonth,
      status: charge.status,
      memo: charge.memo,
      createdAt: charge.createdAt,
      updatedAt: charge.updatedAt,
    }));
  }

}
