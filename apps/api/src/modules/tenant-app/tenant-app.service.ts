import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantCouponsService } from '../tenants/tenant-coupons.service';
import { CreateTenantCouponPurchaseDto } from '../tenants/dto/create-tenant-coupon-purchase.dto';
import { AssignTenantCouponDto } from '../tenants/dto/assign-tenant-coupon.dto';

type TenantApplicationBody = {
  parkingLotId?: string;
  parkingLotCode?: string;
  companyName?: string;
  businessNumber?: string;
  pin?: string;
  representative?: string;
  contact?: string;
  billingEmail?: string;
  applicantName?: string;
  applicantPhone?: string;
  applicantEmail?: string;
  memo?: string;
};

@Injectable()
export class TenantAppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly tenantCouponsService: TenantCouponsService,
  ) {}

  private getUserId(user?: any) {
    return user?.id ?? user?.userId ?? user?.sub ?? null;
  }

  private getUserRole(user?: any) {
    return String(user?.role ?? user?.userRole ?? user?.type ?? '').toUpperCase();
  }

  private normalizeStatus(status?: string) {
    const value = String(status ?? 'PENDING').toUpperCase();

    if (['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(value)) {
      return value;
    }

    return 'PENDING';
  }

  private normalizeText(value?: string | null) {
    const trimmed = String(value ?? '').trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private validateBusinessNumber(value?: string | null) {
    const raw = String(value ?? '').trim();

    if (raw.includes('-')) {
      throw new BadRequestException('Business number must be entered without hyphens.');
    }

    if (!/^\d{10}$/.test(raw)) {
      throw new BadRequestException('Business number must be exactly 10 digits.');
    }

    return raw;
  }

  private formatBusinessNumber(value?: string | null) {
    const raw = String(value ?? '').replace(/\D/g, '');

    if (!/^\d{10}$/.test(raw)) return value ?? null;

    return `${raw.slice(0, 3)}-${raw.slice(3, 5)}-${raw.slice(5)}`;
  }

  private validatePin(value?: string | null) {
    const pin = String(value ?? '').trim();

    if (!/^\d{4,6}$/.test(pin)) {
      throw new BadRequestException('PIN must be 4 to 6 digits.');
    }

    return pin;
  }

  private hashPin(pin: string) {
    return createHash('sha256').update(`tenant-pin:${pin}`).digest('hex');
  }

  private assertApplicationCredentialReady(application: {
    businessNumber?: string | null;
    pinHash?: string | null;
  }) {
    if (!application.businessNumber || !/^\d{10}$/.test(application.businessNumber)) {
      throw new BadRequestException('Valid business number is required before approval.');
    }

    if (!application.pinHash) {
      throw new BadRequestException('PIN is required before approval.');
    }
  }

  private extractTenantAppToken(authorization?: string | null) {
    const value = String(authorization ?? '').trim();

    if (!value) {
      throw new UnauthorizedException('Tenant app login is required.');
    }

    const match = value.match(/^Bearer\s+(.+)$/i);

    if (!match?.[1]) {
      throw new UnauthorizedException('Invalid authorization header.');
    }

    return match[1];
  }

  private verifyTenantAppToken(authorization?: string | null) {
    const token = this.extractTenantAppToken(authorization);

    try {
      const payload = this.jwtService.verify(token) as {
        sub?: string;
        tenantId?: string;
        businessNumber?: string;
        role?: string;
        type?: string;
      };

      if (payload.type !== 'TENANT_APP' || payload.role !== 'TENANT') {
        throw new UnauthorizedException('Invalid tenant app token.');
      }

      if (!payload.sub || !payload.tenantId || !payload.businessNumber) {
        throw new UnauthorizedException('Invalid tenant app token payload.');
      }

      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Tenant app login has expired or is invalid.');
    }
  }

  async login(body: { businessNumber?: string; pin?: string }) {
    const businessNumber = this.validateBusinessNumber(body.businessNumber);
    const pin = this.validatePin(body.pin);
    const pinHash = this.hashPin(pin);

    const credential = await this.prisma.tenantAppCredential.findUnique({
      where: {
        businessNumber,
      },
      include: {
        tenant: {
          include: {
            parkingLot: true,
            managementCompany: true,
          },
        },
      },
    });

    if (!credential || credential.pinHash !== pinHash) {
      throw new UnauthorizedException('Business number or PIN is incorrect.');
    }

    if (!credential.tenant?.isActive) {
      throw new ForbiddenException('Tenant is not active.');
    }

    const accessToken = this.jwtService.sign({
      sub: credential.id,
      tenantId: credential.tenantId,
      businessNumber: credential.businessNumber,
      role: 'TENANT',
      type: 'TENANT_APP',
    });

    await this.prisma.tenantAppCredential.update({
      where: {
        id: credential.id,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });

    return {
      ok: true,
      accessToken,
      tenant: this.mapTenantForApp(credential.tenant),
    };
  }

  async me(authorization?: string | null) {
    const payload = this.verifyTenantAppToken(authorization);

    const credential = await this.prisma.tenantAppCredential.findUnique({
      where: {
        id: payload.sub,
      },
      include: {
        tenant: {
          include: {
            parkingLot: true,
            managementCompany: true,
          },
        },
      },
    });

    if (!credential || credential.tenantId !== payload.tenantId) {
      throw new UnauthorizedException('Tenant app login is invalid.');
    }

    return {
      ok: true,
      credential: {
        id: credential.id,
        businessNumber: this.formatBusinessNumber(credential.businessNumber),
        lastLoginAt: credential.lastLoginAt,
        pinUpdatedAt: credential.pinUpdatedAt,
      },
      tenant: this.mapTenantForApp(credential.tenant),
    };
  }

  async changePin(
    authorization: string | null | undefined,
    body: { currentPin?: string; newPin?: string },
  ) {
    const payload = this.verifyTenantAppToken(authorization);

    const currentPin = this.validatePin(body.currentPin);
    const newPin = this.validatePin(body.newPin);

    if (currentPin === newPin) {
      throw new BadRequestException('New PIN must be different from the current PIN.');
    }

    const credential = await this.prisma.tenantAppCredential.findUnique({
      where: {
        id: payload.sub,
      },
    });

    if (!credential || credential.tenantId !== payload.tenantId) {
      throw new UnauthorizedException('Tenant app login is invalid.');
    }

    if (credential.pinHash !== this.hashPin(currentPin)) {
      throw new UnauthorizedException('Current PIN is incorrect.');
    }

    await this.prisma.tenantAppCredential.update({
      where: {
        id: credential.id,
      },
      data: {
        pinHash: this.hashPin(newPin),
        pinUpdatedAt: new Date(),
      },
    });

    return {
      ok: true,
      message: 'PIN has been changed.',
    };
  }

  private mapTenantForApp(tenant: any) {
    return {
      id: tenant.id,
      name: tenant.name,
      code: tenant.code,
      businessNumber: this.formatBusinessNumber(tenant.businessNumber),
      representative: tenant.representative ?? null,
      contact: tenant.contact ?? null,
      billingEmail: tenant.billingEmail ?? null,
      isActive: tenant.isActive ?? true,
      parkingLotId: tenant.parkingLotId ?? null,
      parkingLotName: tenant.parkingLot?.name ?? null,
      parkingLotCode: tenant.parkingLot?.code ?? null,
      managementCompanyId: tenant.managementCompanyId ?? null,
      managementCompanyName: tenant.managementCompany?.name ?? null,
      managementCompanyCode: tenant.managementCompany?.code ?? null,
    };
  }

  private async getTenantAppContext(authorization?: string | null) {
    const payload = this.verifyTenantAppToken(authorization);

    const credential = await this.prisma.tenantAppCredential.findUnique({
      where: {
        id: payload.sub,
      },
      include: {
        tenant: true,
      },
    });

    if (!credential || credential.tenantId !== payload.tenantId) {
      throw new UnauthorizedException('Tenant app login is invalid.');
    }

    if (!credential.tenant?.isActive) {
      throw new ForbiddenException('Tenant is not active.');
    }

    if (!credential.tenant.parkingLotId) {
      throw new BadRequestException('Tenant parking lot is not configured.');
    }

    return {
      payload,
      credential,
      tenant: credential.tenant,
    };
  }

  async listCouponProducts(authorization?: string) {
    const { tenant } = await this.getTenantAppContext(authorization);
    return this.tenantCouponsService.listProductsForTenantApp(tenant.id);
  }

  async listCouponPurchases(authorization?: string) {
    const { tenant } = await this.getTenantAppContext(authorization);
    return this.tenantCouponsService.listPurchasesForTenantApp(tenant.id);
  }

  async createCouponPurchase(
    authorization: string | undefined,
    dto: CreateTenantCouponPurchaseDto,
  ) {
    const { tenant, credential } = await this.getTenantAppContext(authorization);
    return this.tenantCouponsService.createPurchaseForTenantApp(
      tenant.id,
      credential.id,
      dto,
    );
  }

  async getCouponInventory(authorization?: string) {
    const { tenant } = await this.getTenantAppContext(authorization);
    return this.tenantCouponsService.getInventoryForTenantApp(tenant.id);
  }

  async searchCouponMembers(authorization: string | undefined, query?: string) {
    const { tenant } = await this.getTenantAppContext(authorization);
    return this.tenantCouponsService.searchMembersForTenantApp(
      tenant.id,
      String(query ?? ''),
    );
  }

  async assignCoupon(
    authorization: string | undefined,
    dto: AssignTenantCouponDto,
  ) {
    const { tenant, credential } = await this.getTenantAppContext(authorization);
    return this.tenantCouponsService.assignCouponForTenantApp(
      tenant.id,
      credential.id,
      dto,
    );
  }

  async listCouponAssignments(authorization?: string) {
    const { tenant } = await this.getTenantAppContext(authorization);
    return this.tenantCouponsService.listAssignmentsForTenantApp(tenant.id);
  }

  async searchVisits(authorization: string | undefined, query?: string) {
    const { tenant } = await this.getTenantAppContext(authorization);
    const keyword = String(query ?? '').trim();
    const digits = keyword.replace(/\D/g, '');

    if (keyword.length < 2 && digits.length < 3) {
      throw new BadRequestException('Search keyword must be at least 2 characters.');
    }

    const platePattern = `%${keyword}%`;
    const phonePattern = digits.length >= 3 ? `%${digits}%` : null;

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        ps.id,
        ps."sessionNo",
        ps.status,
        ps."plateNumber",
        ps."contactPhone",
        ps."entryTime",
        ps."exitTime",
        sec."parkingLotId" AS "parkingLotId",
        sp."sectionId" AS "parkingSectionId",
        ps."parkingSpaceId",
        sp.code AS "spaceCode",
        sec.code AS "sectionCode",
        EXISTS (
          SELECT 1
          FROM "TenantVisitConfirmation" tvc
          WHERE tvc."tenantId" = $4
            AND tvc."parkingSessionId" = ps.id
        ) AS "alreadyConfirmed"
      FROM "ParkingSession" ps
      JOIN "ParkingSpace" sp ON sp.id = ps."parkingSpaceId"
      JOIN "ParkingSection" sec ON sec.id = sp."sectionId"
      WHERE sec."parkingLotId" = $1
        AND ps."exitTime" IS NULL
        AND (
          COALESCE(ps."plateNumber", '') ILIKE $2
          OR (
            $3::text IS NOT NULL
            AND regexp_replace(COALESCE(ps."contactPhone", ''), '[^0-9]', '', 'g') LIKE $3
          )
        )
      ORDER BY ps."entryTime" DESC NULLS LAST, ps.id DESC
      LIMIT 20
      `,
      tenant.parkingLotId,
      platePattern,
      phonePattern,
      tenant.id,
    );

    return {
      ok: true,
      items: rows.map((row) => this.mapVisitSearchRow(row)),
    };
  }

  async confirmVisitFromApp(
    authorization: string | undefined,
    parkingSessionId: string,
    body?: { note?: string },
  ) {
    const { credential, tenant } = await this.getTenantAppContext(authorization);

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        ps.id,
        ps."sessionNo",
        ps.status,
        ps."plateNumber",
        ps."contactPhone",
        ps."entryTime",
        ps."exitTime",
        sec."parkingLotId" AS "parkingLotId",
        sp."sectionId" AS "parkingSectionId",
        ps."parkingSpaceId",
        sp.code AS "spaceCode",
        sec.code AS "sectionCode"
      FROM "ParkingSession" ps
      JOIN "ParkingSpace" sp ON sp.id = ps."parkingSpaceId"
      JOIN "ParkingSection" sec ON sec.id = sp."sectionId"
      WHERE ps.id = $1
        AND sec."parkingLotId" = $2
      LIMIT 1
      `,
      parkingSessionId,
      tenant.parkingLotId,
    );

    const session = rows[0];

    if (!session) {
      throw new NotFoundException('Parking session was not found for this tenant.');
    }

    if (session.exitTime) {
      throw new BadRequestException('Exited parking session cannot be confirmed.');
    }

    const existing = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT id, "confirmedAt"
      FROM "TenantVisitConfirmation"
      WHERE "parkingSessionId" = $1
        AND "tenantId" = $2
      LIMIT 1
      `,
      parkingSessionId,
      tenant.id,
    );

    if (existing[0]) {
      return {
        ok: true,
        alreadyConfirmed: true,
        confirmation: {
          id: existing[0].id,
          confirmedAt: existing[0].confirmedAt,
        },
      };
    }

    const now = new Date();
    const graceMinutes = 10;
    const graceUntil = new Date(now.getTime() + graceMinutes * 60 * 1000);
    const confirmationId = `tenant_visit_${randomUUID()}`;
    const note = this.normalizeText(body?.note);

    await this.prisma.$executeRawUnsafe(
      `
      INSERT INTO "TenantVisitConfirmation" (
        id,
        "tenantId",
        "parkingSessionId",
        "parkingLotId",
        "parkingSectionId",
        "parkingSpaceId",
        "confirmedByUserId",
        "confirmedByCredentialId",
        "confirmedAt",
        "vehiclePlate",
        "contactPhone",
        "entryTime",
        "coveredAmount",
        "coveredUntil",
        "graceMinutes",
        "graceUntil",
        note,
        status,
        "createdAt",
        "updatedAt"
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        NULL, $7, $8,
        $9, $10, $11,
        0, NULL,
        $12, $13, $14,
        'CONFIRMED',
        $8, $8
      )
      `,
      confirmationId,
      tenant.id,
      session.id,
      session.parkingLotId,
      session.parkingSectionId,
      session.parkingSpaceId,
      credential.id,
      now,
      session.plateNumber,
      session.contactPhone,
      session.entryTime,
      graceMinutes,
      graceUntil,
      note,
    );

    await this.prisma.$executeRawUnsafe(
      `
      UPDATE "ParkingSession"
      SET status = 'PAID',
          "visitTenantId" = $2,
          "tenantConfirmedAt" = $3,
          "tenantGraceUntil" = $4,
          "tenantVisitConfirmedBy" = NULL,
          "updatedAt" = now()
      WHERE id = $1
      `,
      session.id,
      tenant.id,
      now,
      graceUntil,
    );

    return {
      ok: true,
      alreadyConfirmed: false,
      confirmation: {
        id: confirmationId,
        tenantId: tenant.id,
        tenantName: tenant.name,
        parkingSessionId: session.id,
        sessionNo: session.sessionNo,
        plateNumber: session.plateNumber,
        contactPhone: session.contactPhone,
        spaceCode: session.spaceCode,
        sectionCode: session.sectionCode,
        confirmedAt: now,
        graceUntil,
      },
    };
  }

  async visitHistory(
    authorization: string | undefined,
    query?: {
      date?: string;
      q?: string;
    },
  ) {
    const { tenant } = await this.getTenantAppContext(authorization);

    const rawDate = String(query?.date ?? '').trim();
    const historyDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? rawDate
      : new Date().toISOString().slice(0, 10);

    const keyword = String(query?.q ?? '').trim();
    const digits = keyword.replace(/\D/g, '');
    const platePattern = keyword.length > 0 ? `%${keyword}%` : null;
    const phonePattern = digits.length > 0 ? `%${digits}%` : null;

    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        tvc.id,
        tvc."parkingSessionId",
        tvc."confirmedAt",
        tvc."vehiclePlate",
        tvc."contactPhone",
        tvc."entryTime",
        tvc."graceUntil",
        tvc.note,
        tvc.status,
        ps."sessionNo",
        ps."exitTime",
        sp.code AS "spaceCode",
        sec.code AS "sectionCode"
      FROM "TenantVisitConfirmation" tvc
      LEFT JOIN "ParkingSession" ps ON ps.id = tvc."parkingSessionId"
      LEFT JOIN "ParkingSpace" sp ON sp.id = tvc."parkingSpaceId"
      LEFT JOIN "ParkingSection" sec ON sec.id = tvc."parkingSectionId"
      WHERE tvc."tenantId" = $1
        AND tvc."confirmedAt" >= $2::date
        AND tvc."confirmedAt" < ($2::date + interval '1 day')
        AND (
          $3::text IS NULL
          OR COALESCE(tvc."vehiclePlate", '') ILIKE $3
          OR (
            $4::text IS NOT NULL
            AND regexp_replace(COALESCE(tvc."contactPhone", ''), '[^0-9]', '', 'g') LIKE $4
          )
        )
      ORDER BY tvc."confirmedAt" DESC
      LIMIT 100
      `,
      tenant.id,
      historyDate,
      platePattern,
      phonePattern,
    );

    return {
      ok: true,
      date: historyDate,
      q: keyword,
      items: rows.map((row) => this.mapVisitHistoryRow(row)),
    };
  }

  private mapVisitSearchRow(row: any) {
    return {
      id: row.id,
      sessionNo: row.sessionNo,
      status: row.status,
      plateNumber: row.plateNumber ?? null,
      contactPhone: row.contactPhone ?? null,
      entryTime: row.entryTime ?? null,
      exitTime: row.exitTime ?? null,
      parkingLotId: row.parkingLotId ?? null,
      parkingSectionId: row.parkingSectionId ?? null,
      parkingSpaceId: row.parkingSpaceId ?? null,
      sectionCode: row.sectionCode ?? null,
      spaceCode: row.spaceCode ?? null,
      alreadyConfirmed: Boolean(row.alreadyConfirmed),
    };
  }

  private mapVisitHistoryRow(row: any) {
    return {
      id: row.id,
      parkingSessionId: row.parkingSessionId,
      sessionNo: row.sessionNo ?? null,
      confirmedAt: row.confirmedAt ?? null,
      plateNumber: row.vehiclePlate ?? null,
      contactPhone: row.contactPhone ?? null,
      entryTime: row.entryTime ?? null,
      exitTime: row.exitTime ?? null,
      graceUntil: row.graceUntil ?? null,
      sectionCode: row.sectionCode ?? null,
      spaceCode: row.spaceCode ?? null,
      note: row.note ?? null,
      status: row.status ?? null,
    };
  }

  private async getApprovalScope(user?: any) {
    const prisma = this.prisma as any;
    const userId = this.getUserId(user);
    const role = this.getUserRole(user);

    const isAdmin = ['ADMIN', 'SUPERADMIN', 'SUPER_USER', 'SUPERUSER'].includes(role);

    if (isAdmin) {
      return {
        isAdmin: true,
        parkingLotIds: [] as string[],
        managementCompanyId: null as string | null,
      };
    }

    if (!userId) {
      throw new ForbiddenException('User scope is required.');
    }

    const userRow = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        managementCompanyId: true,
      },
    }).catch(() => null);

    const managerProfile = await prisma.managerProfile.findFirst({
      where: { userId },
      select: {
        id: true,
        managementCompanyId: true,
      },
    }).catch(() => null);

    let directParkingLotRows: Array<{ parkingLotId: string }> = [];

    try {
      directParkingLotRows = await prisma.managerParkingLot.findMany({
        where: {
          OR: [
            { managerId: userId },
            { userId },
            managerProfile?.id ? { managerProfileId: managerProfile.id } : undefined,
          ].filter(Boolean),
        },
        select: {
          parkingLotId: true,
        },
      });
    } catch {
      directParkingLotRows = [];
    }

    const parkingLotIds = Array.from(
      new Set(directParkingLotRows.map((row) => row.parkingLotId).filter(Boolean)),
    );

    return {
      isAdmin: false,
      parkingLotIds,
      managementCompanyId:
        userRow?.managementCompanyId ?? managerProfile?.managementCompanyId ?? null,
    };
  }

  private buildApprovalWhere(scope: {
    isAdmin: boolean;
    parkingLotIds: string[];
    managementCompanyId: string | null;
  }) {
    if (scope.isAdmin) return {};

    const or: any[] = [];

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
        id: '__NO_TENANT_APPLICATION_SCOPE__',
      };
    }

    return {
      OR: or,
    };
  }

  private mapParkingLot(parkingLot: any) {
    return {
      id: parkingLot.id,
      name: parkingLot.name,
      code: parkingLot.code,
      region: parkingLot.region ?? null,
      isActive: parkingLot.isActive,
      managementCompanyId: parkingLot.managementCompanyId ?? null,
      managementCompanyName: parkingLot.managementCompany?.name ?? null,
      managementCompanyCode: parkingLot.managementCompany?.code ?? null,
    };
  }

  private mapApplication(application: any) {
    return {
      id: application.id,
      status: application.status,

      parkingLotId: application.parkingLotId,
      parkingLotName: application.parkingLot?.name ?? null,
      parkingLotCode: application.parkingLot?.code ?? null,

      managementCompanyId: application.managementCompanyId ?? null,
      managementCompanyName: application.managementCompany?.name ?? null,
      managementCompanyCode: application.managementCompany?.code ?? null,

      tenantId: application.tenantId ?? null,
      tenantName: application.tenant?.name ?? null,
      tenantCode: application.tenant?.code ?? null,

      companyName: application.companyName,
      businessNumber: this.formatBusinessNumber(application.businessNumber) ?? null,
      representative: application.representative ?? null,
      contact: application.contact ?? null,
      billingEmail: application.billingEmail ?? null,

      applicantName: application.applicantName ?? null,
      applicantPhone: application.applicantPhone ?? null,
      applicantEmail: application.applicantEmail ?? null,
      memo: application.memo ?? null,

      approvedAt: application.approvedAt ?? null,
      approvedByUserId: application.approvedByUserId ?? null,
      rejectedAt: application.rejectedAt ?? null,
      rejectedByUserId: application.rejectedByUserId ?? null,
      rejectReason: application.rejectReason ?? null,

      createdAt: application.createdAt,
      updatedAt: application.updatedAt,
    };
  }

  async findParkingLotByCode(code: string) {
    const prisma = this.prisma as any;
    const normalizedCode = this.normalizeText(code);

    if (!normalizedCode) {
      throw new BadRequestException('Parking lot code is required.');
    }

    const parkingLot = await prisma.parkingLot.findFirst({
      where: {
        OR: [
          { code: normalizedCode },
          { id: normalizedCode },
        ],
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
        region: true,
        isActive: true,
        managementCompanyId: true,
        managementCompany: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
    });

    if (!parkingLot) {
      throw new NotFoundException('Parking lot not found.');
    }

    return {
      ok: true,
      parkingLot: this.mapParkingLot(parkingLot),
    };
  }

  async createApplication(body: TenantApplicationBody) {
    const prisma = this.prisma as any;

    const parkingLotId = this.normalizeText(body.parkingLotId);
    const parkingLotCode = this.normalizeText(body.parkingLotCode);
    const companyName = this.normalizeText(body.companyName);
    const businessNumber = this.validateBusinessNumber(body.businessNumber);
    const pin = this.validatePin(body.pin);
    const pinHash = this.hashPin(pin);

    if (!parkingLotId && !parkingLotCode) {
      throw new BadRequestException('Parking lot is required.');
    }

    if (!companyName) {
      throw new BadRequestException('Company name is required.');
    }

    const parkingLot = await prisma.parkingLot.findFirst({
      where: {
        isActive: true,
        OR: [
          parkingLotId ? { id: parkingLotId } : undefined,
          parkingLotCode ? { code: parkingLotCode } : undefined,
        ].filter(Boolean),
      },
      select: {
        id: true,
        name: true,
        code: true,
        managementCompanyId: true,
      },
    });

    if (!parkingLot) {
      throw new NotFoundException('Parking lot not found.');
    }

    const application = await prisma.tenantApplication.create({
      data: {
        parkingLotId: parkingLot.id,
        managementCompanyId: parkingLot.managementCompanyId,
        companyName,
        businessNumber,
        pinHash,
        representative: this.normalizeText(body.representative),
        contact: this.normalizeText(body.contact),
        billingEmail: this.normalizeText(body.billingEmail),
        applicantName: this.normalizeText(body.applicantName),
        applicantPhone: this.normalizeText(body.applicantPhone),
        applicantEmail: this.normalizeText(body.applicantEmail),
        memo: this.normalizeText(body.memo),
        status: 'PENDING',
      },
      include: {
        parkingLot: true,
        managementCompany: true,
        tenant: true,
      },
    });

    return {
      ok: true,
      application: this.mapApplication(application),
    };
  }

  async findApprovals(
    user: any,
    query: {
      status?: string;
      parkingLotId?: string;
    },
  ) {
    const prisma = this.prisma as any;
    const scope = await this.getApprovalScope(user);

    const status = this.normalizeStatus(query.status);
    const parkingLotId = this.normalizeText(query.parkingLotId);

    const where: any = {
      ...this.buildApprovalWhere(scope),
      status,
    };

    if (parkingLotId) {
      where.parkingLotId = parkingLotId;
    }

    const applications = await prisma.tenantApplication.findMany({
      where,
      include: {
        parkingLot: true,
        managementCompany: true,
        tenant: true,
      },
      orderBy: [
        { createdAt: 'desc' },
      ],
      take: 200,
    });

    return applications.map((application: any) => this.mapApplication(application));
  }

  private async generateTenantCode(companyName: string) {
    const prisma = this.prisma as any;

    const base = companyName
      .replace(/[^0-9a-zA-Z가-힣]/g, '')
      .slice(0, 12)
      .toUpperCase();

    for (let i = 0; i < 20; i += 1) {
      const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
      const code = `TENANT-${base || 'APP'}-${suffix}`.slice(0, 48);

      const exists = await prisma.tenant.findUnique({
        where: { code },
        select: { id: true },
      });

      if (!exists) return code;
    }

    return `TENANT-${Date.now()}`;
  }

  async approveApplication(id: string, user: any) {
    const prisma = this.prisma as any;
    const userId = this.getUserId(user);

    if (!userId) {
      throw new ForbiddenException('User is required.');
    }

    const scope = await this.getApprovalScope(user);

    const application = await prisma.tenantApplication.findFirst({
      where: {
        id,
        ...this.buildApprovalWhere(scope),
      },
      include: {
        parkingLot: true,
        managementCompany: true,
        tenant: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Tenant application not found.');
    }

    this.assertApplicationCredentialReady(application);

    if (application.status !== 'PENDING') {
      throw new BadRequestException('Only pending tenant applications can be approved.');
    }

    const result = await prisma.$transaction(async (tx: any) => {
      const tenantCode = await this.generateTenantCode(application.companyName);

      const tenant = await tx.tenant.create({
        data: {
          name: application.companyName,
          code: tenantCode,
          managementCompanyId: application.managementCompanyId,
          parkingLotId: application.parkingLotId,
          businessNumber: application.businessNumber,
          representative: application.representative,
          contact: application.contact,
          billingEmail: application.billingEmail,
          memo: application.memo,
          isActive: true,
        },
      });

      await tx.tenantAppCredential.upsert({
        where: {
          businessNumber: application.businessNumber!,
        },
        create: {
          tenantId: tenant.id,
          businessNumber: application.businessNumber!,
          pinHash: application.pinHash!,
        },
        update: {
          tenantId: tenant.id,
          pinHash: application.pinHash!,
          pinUpdatedAt: new Date(),
        },
      });

      const updatedApplication = await tx.tenantApplication.update({
        where: { id: application.id },
        data: {
          status: 'APPROVED',
          tenantId: tenant.id,
          approvedAt: new Date(),
          approvedByUserId: userId,
          updatedAt: new Date(),
        },
        include: {
          parkingLot: true,
          managementCompany: true,
          tenant: true,
        },
      });

      return {
        tenant,
        application: updatedApplication,
      };
    });

    return {
      ok: true,
      tenant: result.tenant,
      application: this.mapApplication(result.application),
    };
  }

  async rejectApplication(id: string, body: { rejectReason?: string }, user: any) {
    const prisma = this.prisma as any;
    const userId = this.getUserId(user);

    if (!userId) {
      throw new ForbiddenException('User is required.');
    }

    const scope = await this.getApprovalScope(user);

    const application = await prisma.tenantApplication.findFirst({
      where: {
        id,
        ...this.buildApprovalWhere(scope),
      },
      include: {
        parkingLot: true,
        managementCompany: true,
        tenant: true,
      },
    });

    if (!application) {
      throw new NotFoundException('Tenant application not found.');
    }

    if (application.status !== 'PENDING') {
      throw new BadRequestException('Only pending tenant applications can be rejected.');
    }

    const updatedApplication = await prisma.tenantApplication.update({
      where: { id: application.id },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedByUserId: userId,
        rejectReason: this.normalizeText(body?.rejectReason),
        updatedAt: new Date(),
      },
      include: {
        parkingLot: true,
        managementCompany: true,
        tenant: true,
      },
    });

    return {
      ok: true,
      application: this.mapApplication(updatedApplication),
    };
  }
}
