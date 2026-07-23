import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { PaymentStatus } from '@parking/db';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTenantCouponProductDto } from './dto/create-tenant-coupon-product.dto';
import { UpdateTenantCouponProductDto } from './dto/update-tenant-coupon-product.dto';
import { CreateTenantCouponPurchaseDto } from './dto/create-tenant-coupon-purchase.dto';
import { ConfirmTenantCouponPaymentDto } from './dto/confirm-tenant-coupon-payment.dto';
import { AssignTenantCouponDto } from './dto/assign-tenant-coupon.dto';

type CouponAuthUser = {
  id?: string;
  sub?: string;
  role?: string | null;
  roles?: Array<string | { code?: string | null; role?: { code?: string | null } }>;
};

@Injectable()
export class TenantCouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async listProducts(user: CouponAuthUser | undefined, parkingLotId?: string) {
    const context = await this.getContext(user);
    const allowedLotIds = await this.getAllowedParkingLotIds(context);

    if (!context.isAdmin && allowedLotIds.length === 0) return [];
    if (
      parkingLotId &&
      !context.isAdmin &&
      !allowedLotIds.includes(parkingLotId)
    ) {
      throw new ForbiddenException('Parking lot access denied');
    }

    return this.prisma.tenantCouponProduct.findMany({
      where: {
        ...(parkingLotId
          ? { parkingLotId }
          : context.isAdmin
            ? {}
            : { parkingLotId: { in: allowedLotIds } }),
      },
      include: {
        parkingLot: { select: { id: true, name: true, code: true } },
        _count: { select: { purchases: true, coupons: true } },
      },
      orderBy: [{ parkingLotId: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createProduct(
    user: CouponAuthUser | undefined,
    dto: CreateTenantCouponProductDto,
  ) {
    await this.assertParkingLotManager(user, dto.parkingLotId);
    this.validateBenefit(dto.benefitType, dto.benefitValue);

    return this.prisma.tenantCouponProduct.create({
      data: {
        parkingLotId: dto.parkingLotId,
        code: this.normalizeCode(dto.code),
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        benefitType: dto.benefitType as any,
        benefitValue: dto.benefitValue,
        salePrice: dto.salePrice,
        validityMonths: dto.validityMonths ?? 1,
        stackableWithAutomaticDiscount:
          dto.stackableWithAutomaticDiscount ?? true,
        isActive: dto.isActive ?? true,
      },
      include: {
        parkingLot: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async updateProduct(
    user: CouponAuthUser | undefined,
    id: string,
    dto: UpdateTenantCouponProductDto,
  ) {
    const current = await this.prisma.tenantCouponProduct.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException('Tenant coupon product not found');

    await this.assertParkingLotManager(user, current.parkingLotId);

    const benefitType = dto.benefitType ?? String(current.benefitType);
    const benefitValue = dto.benefitValue ?? current.benefitValue;
    this.validateBenefit(benefitType, benefitValue);

    if (
      dto.parkingLotId !== undefined &&
      dto.parkingLotId !== current.parkingLotId
    ) {
      await this.assertParkingLotManager(user, dto.parkingLotId);
    }

    return this.prisma.tenantCouponProduct.update({
      where: { id },
      data: {
        ...(dto.parkingLotId !== undefined
          ? { parkingLotId: dto.parkingLotId }
          : {}),
        ...(dto.code !== undefined
          ? { code: this.normalizeCode(dto.code) }
          : {}),
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description?.trim() || null }
          : {}),
        ...(dto.benefitType !== undefined
          ? { benefitType: dto.benefitType as any }
          : {}),
        ...(dto.benefitValue !== undefined
          ? { benefitValue: dto.benefitValue }
          : {}),
        ...(dto.salePrice !== undefined ? { salePrice: dto.salePrice } : {}),
        ...(dto.validityMonths !== undefined
          ? { validityMonths: dto.validityMonths }
          : {}),
        ...(dto.stackableWithAutomaticDiscount !== undefined
          ? {
              stackableWithAutomaticDiscount:
                dto.stackableWithAutomaticDiscount,
            }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        parkingLot: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async createPurchase(
    user: CouponAuthUser | undefined,
    tenantId: string,
    dto: CreateTenantCouponPurchaseDto,
  ) {
    const { tenant, context } = await this.assertTenantAccess(user, tenantId);
    const product = await this.prisma.tenantCouponProduct.findUnique({
      where: { id: dto.productId },
    });

    if (!product?.isActive) {
      throw new BadRequestException('Active tenant coupon product not found');
    }
    if (!tenant.parkingLotId || product.parkingLotId !== tenant.parkingLotId) {
      throw new BadRequestException(
        'Coupon product must belong to the tenant parking lot',
      );
    }

    const totalAmount = product.salePrice * dto.quantity;
    const requestedByUserId = context.userId;

    return this.prisma.tenantCouponPurchase.create({
      data: {
        purchaseNo: this.generatePurchaseNo(),
        tenantId,
        productId: product.id,
        quantity: dto.quantity,
        unitPrice: product.salePrice,
        totalAmount,
        status: 'PAYMENT_PENDING' as any,
        memo: dto.memo?.trim() || null,
        requestedByUserId,
      },
      include: {
        tenant: { select: { id: true, name: true, code: true } },
        product: true,
      },
    });
  }

  async listPurchases(user: CouponAuthUser | undefined, tenantId: string) {
    await this.assertTenantAccess(user, tenantId);

    return this.prisma.tenantCouponPurchase.findMany({
      where: { tenantId },
      include: {
        product: true,
        requestedBy: { select: { id: true, name: true } },
        paymentConfirmedBy: { select: { id: true, name: true } },
        _count: { select: { coupons: true } },
      },
      orderBy: { requestedAt: 'desc' },
      take: 200,
    });
  }

  async confirmPaymentAndIssue(
    user: CouponAuthUser | undefined,
    tenantId: string,
    purchaseId: string,
    dto: ConfirmTenantCouponPaymentDto,
  ) {
    const { tenant, context } = await this.assertTenantAccess(
      user,
      tenantId,
      true,
    );

    const purchase = await this.prisma.tenantCouponPurchase.findFirst({
      where: { id: purchaseId, tenantId },
      include: { product: true },
    });
    if (!purchase) throw new NotFoundException('Coupon purchase not found');
    if (purchase.status === ('ISSUED' as any)) {
      throw new BadRequestException('Coupon purchase is already issued');
    }
    if (purchase.status === ('CANCELLED' as any)) {
      throw new BadRequestException('Cancelled purchase cannot be issued');
    }
    if (dto.paidAmount < purchase.totalAmount) {
      throw new BadRequestException(
        'Paid amount must cover the purchase total amount',
      );
    }
    if (!tenant.parkingLotId || purchase.product.parkingLotId !== tenant.parkingLotId) {
      throw new BadRequestException('Tenant and coupon product parking lot mismatch');
    }

    const issuedAt = new Date();
    const expiresAt = this.addMonths(
      issuedAt,
      Math.max(1, purchase.product.validityMonths),
    );
    const couponRows = Array.from({ length: purchase.quantity }, () =>
      this.buildCouponRow({
        tenantId,
        productId: purchase.productId,
        purchaseId: purchase.id,
        expiresAt,
      }),
    );

    return this.prisma.$transaction(async (tx: any) => {
      const locked = await tx.tenantCouponPurchase.updateMany({
        where: {
          id: purchase.id,
          tenantId,
          status: { in: ['REQUESTED', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED'] },
        },
        data: {
          status: 'PAYMENT_CONFIRMED',
          paidAmount: dto.paidAmount,
          paymentReference: dto.paymentReference.trim(),
          paymentConfirmedByUserId: context.userId,
          paymentConfirmedAt: issuedAt,
          memo: dto.memo?.trim() || purchase.memo,
        },
      });
      if (locked.count !== 1) {
        throw new BadRequestException('Coupon purchase state changed');
      }

      await tx.tenantCoupon.createMany({ data: couponRows });
      await tx.tenantCouponEvent.createMany({
        data: couponRows.map((coupon) => ({
          id: randomUUID(),
          couponId: coupon.id,
          eventType: 'ISSUED',
          fromStatus: null,
          toStatus: 'AVAILABLE',
          actorUserId: context.userId,
          metadata: {
            purchaseId: purchase.id,
            purchaseNo: purchase.purchaseNo,
            paymentReference: dto.paymentReference.trim(),
          },
        })),
      });

      return tx.tenantCouponPurchase.update({
        where: { id: purchase.id },
        data: {
          status: 'ISSUED',
          issuedAt,
          expiresAt,
        },
        include: {
          tenant: { select: { id: true, name: true, code: true } },
          product: true,
          _count: { select: { coupons: true } },
        },
      });
    });
  }

  async getInventory(user: CouponAuthUser | undefined, tenantId: string) {
    await this.assertTenantAccess(user, tenantId);
    await this.expireCoupons(tenantId);

    const [groups, products] = await Promise.all([
      this.prisma.tenantCoupon.groupBy({
        by: ['productId', 'status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.prisma.tenantCouponProduct.findMany({
        where: { coupons: { some: { tenantId } } },
        select: {
          id: true,
          code: true,
          name: true,
          benefitType: true,
          benefitValue: true,
          salePrice: true,
          validityMonths: true,
          isActive: true,
        },
      }),
    ]);

    const grouped = new Map<string, Record<string, number>>();
    for (const group of groups as any[]) {
      const counts = grouped.get(group.productId) ?? {};
      counts[String(group.status)] = Number(group._count?._all ?? 0);
      grouped.set(group.productId, counts);
    }

    return products.map((product) => {
      const counts = grouped.get(product.id) ?? {};
      const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
      return {
        product,
        total,
        available: counts.AVAILABLE ?? 0,
        assigned: counts.ASSIGNED ?? 0,
        reserved: counts.RESERVED ?? 0,
        used: counts.USED ?? 0,
        expired: counts.EXPIRED ?? 0,
        cancelled: counts.CANCELLED ?? 0,
      };
    });
  }

  async searchMembers(
    user: CouponAuthUser | undefined,
    tenantId: string,
    query: string,
  ) {
    await this.assertTenantAccess(user, tenantId);
    const keyword = String(query ?? '').trim();
    if (keyword.length < 2) {
      throw new BadRequestException('Search query must be at least 2 characters');
    }

    const phone = keyword.replace(/\D/g, '');
    const plate = keyword.replace(/\s/g, '').toUpperCase();

    const members = await this.prisma.user.findMany({
      where: {
        memberProfile: { isNot: null },
        OR: [
          ...(phone ? [{ phone: { contains: phone } }] : []),
          {
            vehicles: {
              some: {
                vehicle: {
                  plateNumber: { contains: plate, mode: 'insensitive' },
                  isActive: true,
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        status: true,
        vehicles: {
          where: { vehicle: { isActive: true } },
          select: {
            isPrimary: true,
            vehicle: {
              select: {
                id: true,
                plateNumber: true,
                sizeClass: true,
                powertrainType: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return members.map((member) => ({
      id: member.id,
      name: member.name,
      phoneMasked: this.maskPhone(member.phone),
      status: member.status,
      vehicles: member.vehicles,
    }));
  }

  async assignCoupon(
    user: CouponAuthUser | undefined,
    tenantId: string,
    dto: AssignTenantCouponDto,
  ) {
    const { tenant, context } = await this.assertTenantAccess(user, tenantId);
    await this.expireCoupons(tenantId);

    const [product, member] = await Promise.all([
      this.prisma.tenantCouponProduct.findUnique({
        where: { id: dto.productId },
      }),
      this.prisma.user.findUnique({
        where: { id: dto.memberUserId },
        select: {
          id: true,
          name: true,
          phone: true,
          status: true,
          memberProfile: { select: { id: true } },
        },
      }),
    ]);

    if (!product?.isActive) {
      throw new BadRequestException('Active tenant coupon product not found');
    }
    if (!tenant.parkingLotId || product.parkingLotId !== tenant.parkingLotId) {
      throw new BadRequestException('Coupon product does not belong to tenant lot');
    }
    if (!member?.memberProfile || member.status !== ('ACTIVE' as any)) {
      throw new BadRequestException('Active member not found');
    }

    return this.prisma.$transaction(async (tx: any) => {
      const coupon = await tx.tenantCoupon.findFirst({
        where: {
          tenantId,
          productId: product.id,
          status: 'AVAILABLE',
          expiresAt: { gt: new Date() },
        },
        orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
      });
      if (!coupon) {
        throw new BadRequestException('No available coupon inventory');
      }

      const updated = await tx.tenantCoupon.updateMany({
        where: { id: coupon.id, status: 'AVAILABLE' },
        data: {
          status: 'ASSIGNED',
          assignedMemberUserId: member.id,
          assignedByUserId: context.userId,
          assignedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException('Coupon was assigned by another request');
      }

      await tx.tenantCouponEvent.create({
        data: {
          couponId: coupon.id,
          eventType: 'ASSIGNED',
          fromStatus: 'AVAILABLE',
          toStatus: 'ASSIGNED',
          actorUserId: context.userId,
          memberUserId: member.id,
          metadata: {
            tenantId,
            productId: product.id,
          },
        },
      });

      return tx.tenantCoupon.findUnique({
        where: { id: coupon.id },
        include: {
          product: true,
          tenant: { select: { id: true, name: true, code: true } },
          assignedMember: { select: { id: true, name: true, phone: true } },
          assignedBy: { select: { id: true, name: true } },
        },
      });
    });
  }

  async listAssignments(user: CouponAuthUser | undefined, tenantId: string) {
    await this.assertTenantAccess(user, tenantId);
    await this.expireCoupons(tenantId);

    return this.prisma.tenantCoupon.findMany({
      where: {
        tenantId,
        assignedMemberUserId: { not: null },
      },
      include: {
        product: true,
        assignedMember: { select: { id: true, name: true, phone: true } },
        assignedBy: { select: { id: true, name: true } },
      },
      orderBy: { assignedAt: 'desc' },
      take: 300,
    });
  }

  async listProductsForTenantApp(tenantId: string) {
    const tenant = await this.getActiveTenantForApp(tenantId);

    return this.prisma.tenantCouponProduct.findMany({
      where: {
        parkingLotId: tenant.parkingLotId,
        isActive: true,
      },
      include: {
        parkingLot: { select: { id: true, name: true, code: true } },
        _count: { select: { purchases: true, coupons: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async createPurchaseForTenantApp(
    tenantId: string,
    credentialId: string,
    dto: CreateTenantCouponPurchaseDto,
  ) {
    const tenant = await this.getActiveTenantForApp(tenantId);
    const product = await this.prisma.tenantCouponProduct.findUnique({
      where: { id: dto.productId },
    });

    if (!product?.isActive) {
      throw new BadRequestException('Active tenant coupon product not found');
    }
    if (product.parkingLotId !== tenant.parkingLotId) {
      throw new BadRequestException(
        'Coupon product must belong to the tenant parking lot',
      );
    }

    return this.prisma.tenantCouponPurchase.create({
      data: {
        purchaseNo: this.generatePurchaseNo(),
        tenantId,
        productId: product.id,
        quantity: dto.quantity,
        unitPrice: product.salePrice,
        totalAmount: product.salePrice * dto.quantity,
        status: 'PAYMENT_PENDING' as any,
        memo: dto.memo?.trim() || null,
        requestedByUserId: null,
      },
      include: {
        tenant: { select: { id: true, name: true, code: true } },
        product: true,
      },
    }).then((purchase) => ({
      ...purchase,
      requestedByTenantAppCredentialId: credentialId,
    }));
  }

  async listPurchasesForTenantApp(tenantId: string) {
    await this.getActiveTenantForApp(tenantId);

    return this.prisma.tenantCouponPurchase.findMany({
      where: { tenantId },
      include: {
        product: true,
        paymentConfirmedBy: { select: { id: true, name: true } },
        _count: { select: { coupons: true } },
      },
      orderBy: { requestedAt: 'desc' },
      take: 200,
    });
  }

  async getInventoryForTenantApp(tenantId: string) {
    await this.getActiveTenantForApp(tenantId);
    await this.expireCoupons(tenantId);

    const [groups, products] = await Promise.all([
      this.prisma.tenantCoupon.groupBy({
        by: ['productId', 'status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      this.prisma.tenantCouponProduct.findMany({
        where: { coupons: { some: { tenantId } } },
        select: {
          id: true,
          code: true,
          name: true,
          benefitType: true,
          benefitValue: true,
          salePrice: true,
          validityMonths: true,
          isActive: true,
        },
      }),
    ]);

    const grouped = new Map<string, Record<string, number>>();
    for (const group of groups as any[]) {
      const counts = grouped.get(group.productId) ?? {};
      counts[String(group.status)] = Number(group._count?._all ?? 0);
      grouped.set(group.productId, counts);
    }

    return products.map((product) => {
      const counts = grouped.get(product.id) ?? {};
      const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
      return {
        product,
        total,
        available: counts.AVAILABLE ?? 0,
        assigned: counts.ASSIGNED ?? 0,
        reserved: counts.RESERVED ?? 0,
        used: counts.USED ?? 0,
        expired: counts.EXPIRED ?? 0,
        cancelled: counts.CANCELLED ?? 0,
      };
    });
  }

  async searchMembersForTenantApp(tenantId: string, query: string) {
    await this.getActiveTenantForApp(tenantId);
    const keyword = String(query ?? '').trim();
    if (keyword.length < 2) {
      throw new BadRequestException('Search query must be at least 2 characters');
    }

    const phone = keyword.replace(/\D/g, '');
    const plate = keyword.replace(/\s/g, '').toUpperCase();
    const members = await this.prisma.user.findMany({
      where: {
        memberProfile: { isNot: null },
        status: 'ACTIVE' as any,
        OR: [
          ...(phone ? [{ phone: { contains: phone } }] : []),
          {
            vehicles: {
              some: {
                vehicle: {
                  plateNumber: { contains: plate, mode: 'insensitive' },
                  isActive: true,
                },
              },
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        status: true,
        vehicles: {
          where: { vehicle: { isActive: true } },
          select: {
            isPrimary: true,
            vehicle: {
              select: {
                id: true,
                plateNumber: true,
                sizeClass: true,
                powertrainType: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return members.map((member) => ({
      id: member.id,
      name: member.name,
      phoneMasked: this.maskPhone(member.phone),
      status: member.status,
      vehicles: member.vehicles,
    }));
  }

  async assignCouponForTenantApp(
    tenantId: string,
    credentialId: string,
    dto: AssignTenantCouponDto,
  ) {
    const tenant = await this.getActiveTenantForApp(tenantId);
    await this.expireCoupons(tenantId);

    const [product, member] = await Promise.all([
      this.prisma.tenantCouponProduct.findUnique({
        where: { id: dto.productId },
      }),
      this.prisma.user.findUnique({
        where: { id: dto.memberUserId },
        select: {
          id: true,
          name: true,
          phone: true,
          status: true,
          memberProfile: { select: { id: true } },
        },
      }),
    ]);

    if (!product?.isActive || product.parkingLotId !== tenant.parkingLotId) {
      throw new BadRequestException('Active tenant coupon product not found');
    }
    if (!member?.memberProfile || member.status !== ('ACTIVE' as any)) {
      throw new BadRequestException('Active member not found');
    }

    return this.prisma.$transaction(async (tx: any) => {
      const coupon = await tx.tenantCoupon.findFirst({
        where: {
          tenantId,
          productId: product.id,
          status: 'AVAILABLE',
          expiresAt: { gt: new Date() },
        },
        orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
      });
      if (!coupon) {
        throw new BadRequestException('No available coupon inventory');
      }

      const updated = await tx.tenantCoupon.updateMany({
        where: { id: coupon.id, status: 'AVAILABLE' },
        data: {
          status: 'ASSIGNED',
          assignedMemberUserId: member.id,
          assignedByUserId: null,
          assignedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException('Coupon was assigned by another request');
      }

      await tx.tenantCouponEvent.create({
        data: {
          couponId: coupon.id,
          eventType: 'ASSIGNED',
          fromStatus: 'AVAILABLE',
          toStatus: 'ASSIGNED',
          actorUserId: null,
          memberUserId: member.id,
          metadata: {
            tenantId,
            productId: product.id,
            tenantAppCredentialId: credentialId,
          },
        },
      });

      return tx.tenantCoupon.findUnique({
        where: { id: coupon.id },
        include: {
          product: true,
          tenant: { select: { id: true, name: true, code: true } },
          assignedMember: { select: { id: true, name: true, phone: true } },
        },
      });
    });
  }

  async listAssignmentsForTenantApp(tenantId: string) {
    await this.getActiveTenantForApp(tenantId);
    await this.expireCoupons(tenantId);

    return this.prisma.tenantCoupon.findMany({
      where: {
        tenantId,
        assignedMemberUserId: { not: null },
      },
      include: {
        product: true,
        assignedMember: { select: { id: true, name: true, phone: true } },
      },
      orderBy: { assignedAt: 'desc' },
      take: 300,
    });
  }

  async reserveCouponForSession(input: {
    userId: string;
    couponId: string;
    sessionId: string;
  }) {
    await this.releaseExpiredReservations(input.userId);

    const session = await this.prisma.parkingSession.findUnique({
      where: { id: input.sessionId },
      select: {
        id: true,
        userId: true,
        status: true,
        exitTime: true,
        primaryInvoiceId: true,
        ParkingSpace: {
          select: {
            section: {
              select: {
                parkingLotId: true,
              },
            },
          },
        },
        invoices: {
          select: {
            id: true,
            status: true,
            paidAmount: true,
            metadata: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!session || session.userId !== input.userId) {
      throw new NotFoundException('Member parking session not found');
    }
    if (
      !['ACTIVE', 'GRACE_PERIOD'].includes(String(session.status)) ||
      session.exitTime
    ) {
      throw new BadRequestException(
        'Coupon can only be reserved before exit and invoice finalization',
      );
    }
    const finalizedInvoice = session.invoices.find((invoice) =>
      ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'].includes(
        String(invoice.status),
      ),
    );
    if (session.primaryInvoiceId || finalizedInvoice) {
      const invoiceMetadata = this.asRecord(finalizedInvoice?.metadata);
      const feeCalculation = this.asRecord(invoiceMetadata.feeCalculation);
      const appliedCoupon = this.asRecord(
        invoiceMetadata.tenantCoupon ?? feeCalculation.tenantCoupon,
      );
      const appliedCouponId =
        typeof appliedCoupon.couponId === 'string'
          ? appliedCoupon.couponId
          : null;
      const isUnpaidRetry =
        appliedCouponId === input.couponId &&
        Number(finalizedInvoice?.paidAmount ?? 0) === 0 &&
        ['ISSUED', 'PARTIALLY_PAID'].includes(
          String(finalizedInvoice?.status ?? ''),
        );

      if (!isUnpaidRetry) {
        throw new BadRequestException(
          'Coupon cannot be applied after invoice finalization',
        );
      }
    }

    const parkingLotId = session.ParkingSpace?.section?.parkingLotId ?? null;
    if (!parkingLotId) {
      throw new BadRequestException('Parking lot could not be resolved');
    }

    return this.prisma.$transaction(async (tx: any) => {
      const existing = await tx.tenantCoupon.findFirst({
        where: {
          reservedSessionId: session.id,
          status: 'RESERVED',
          reservationExpiresAt: { gt: new Date() },
        },
        include: {
          product: true,
          tenant: { select: { id: true, name: true, code: true } },
        },
      });

      if (existing?.id === input.couponId) {
        return this.serializeReservation(existing);
      }
      if (existing) {
        throw new BadRequestException(
          'Only one tenant coupon may be reserved per parking session',
        );
      }

      const coupon = await tx.tenantCoupon.findUnique({
        where: { id: input.couponId },
        include: {
          product: true,
          tenant: { select: { id: true, name: true, code: true } },
        },
      });

      if (!coupon || coupon.assignedMemberUserId !== input.userId) {
        throw new NotFoundException('Assigned tenant coupon not found');
      }
      if (coupon.status !== 'ASSIGNED') {
        throw new BadRequestException('Coupon is not available for reservation');
      }
      if (coupon.expiresAt <= new Date()) {
        throw new BadRequestException('Coupon has expired');
      }
      if (!coupon.product.isActive) {
        throw new BadRequestException('Coupon product is inactive');
      }
      if (coupon.product.parkingLotId !== parkingLotId) {
        throw new BadRequestException(
          'Coupon cannot be used at this parking lot',
        );
      }

      const reservedAt = new Date();
      const reservationExpiresAt = new Date(
        reservedAt.getTime() + 15 * 60 * 1000,
      );
      const reservationToken = randomUUID();

      const updated = await tx.tenantCoupon.updateMany({
        where: {
          id: coupon.id,
          status: 'ASSIGNED',
          assignedMemberUserId: input.userId,
        },
        data: {
          status: 'RESERVED',
          reservedSessionId: session.id,
          reservationToken,
          reservationExpiresAt,
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException('Coupon reservation state changed');
      }

      await tx.tenantCouponEvent.create({
        data: {
          couponId: coupon.id,
          eventType: 'RESERVED',
          fromStatus: 'ASSIGNED',
          toStatus: 'RESERVED',
          actorUserId: input.userId,
          memberUserId: input.userId,
          parkingSessionId: session.id,
          metadata: {
            reservationToken,
            reservationExpiresAt: reservationExpiresAt.toISOString(),
          },
        },
      });

      const result = await tx.tenantCoupon.findUnique({
        where: { id: coupon.id },
        include: {
          product: true,
          tenant: { select: { id: true, name: true, code: true } },
        },
      });
      return this.serializeReservation(result);
    });
  }

  async releaseCouponReservation(input: {
    userId: string;
    couponId: string;
    sessionId?: string;
    reason?: string;
  }) {
    const coupon = await this.prisma.tenantCoupon.findFirst({
      where: {
        id: input.couponId,
        assignedMemberUserId: input.userId,
        status: 'RESERVED',
        ...(input.sessionId ? { reservedSessionId: input.sessionId } : {}),
      },
    });
    if (!coupon) {
      return { ok: true, released: false };
    }

    await this.releaseReservedCouponById({
      couponId: coupon.id,
      actorUserId: input.userId,
      reason: input.reason ?? 'MEMBER_RELEASED',
    });

    return { ok: true, released: true, couponId: coupon.id };
  }

  async calculateReservedCouponDiscount(input: {
    sessionId: string;
    amountBeforeCoupon: number;
    baseParkingAmount: number;
    automaticDiscountAmount: number;
    totalMinutes: number;
    feePolicy: any;
    now?: Date;
  }) {
    const now = input.now ?? new Date();
    await this.releaseExpiredReservations();

    const coupon = await this.prisma.tenantCoupon.findFirst({
      where: {
        reservedSessionId: input.sessionId,
        status: 'RESERVED',
        reservationExpiresAt: { gt: now },
      },
      include: {
        product: true,
        tenant: { select: { id: true, name: true, code: true } },
        assignedMember: { select: { id: true } },
      },
    });

    if (!coupon) {
      return this.emptyCouponCalculation(input.amountBeforeCoupon);
    }

    const session = await this.prisma.parkingSession.findUnique({
      where: { id: input.sessionId },
      select: {
        id: true,
        userId: true,
        ParkingSpace: {
          select: {
            section: { select: { parkingLotId: true } },
          },
        },
      },
    });

    if (
      !session ||
      !session.userId ||
      session.userId !== coupon.assignedMemberUserId ||
      coupon.product.parkingLotId !==
        session.ParkingSpace?.section?.parkingLotId
    ) {
      throw new BadRequestException('Reserved coupon is not valid for session');
    }

    if (
      input.automaticDiscountAmount > 0 &&
      !coupon.product.stackableWithAutomaticDiscount
    ) {
      throw new BadRequestException(
        'Selected coupon cannot be combined with automatic discounts',
      );
    }

    const amountBeforeCoupon = Math.max(0, input.amountBeforeCoupon);
    const discountAmount = this.calculateCouponDiscountAmount({
      benefitType: String(coupon.product.benefitType),
      benefitValue: Number(coupon.product.benefitValue),
      amountBeforeCoupon,
      baseParkingAmount: input.baseParkingAmount,
      totalMinutes: input.totalMinutes,
      feePolicy: input.feePolicy,
    });
    const finalAmount = Math.max(0, amountBeforeCoupon - discountAmount);

    return {
      couponId: coupon.id,
      codeMasked: coupon.codeMasked,
      tenantId: coupon.tenantId,
      tenantName: coupon.tenant.name,
      productId: coupon.productId,
      productCode: coupon.product.code,
      productName: coupon.product.name,
      benefitType: String(coupon.product.benefitType),
      benefitValue: coupon.product.benefitValue,
      stackableWithAutomaticDiscount:
        coupon.product.stackableWithAutomaticDiscount,
      reservationExpiresAt: coupon.reservationExpiresAt,
      amountBeforeCoupon,
      discountAmount,
      finalAmount,
    };
  }

  async assertInvoiceCouponReservation(input: {
    sessionId: string;
    invoiceMetadata?: unknown;
  }) {
    const metadata = this.asRecord(input.invoiceMetadata);
    const feeCalculation = this.asRecord(metadata.feeCalculation);
    const tenantCoupon = this.asRecord(
      metadata.tenantCoupon ?? feeCalculation.tenantCoupon,
    );
    const couponId =
      typeof tenantCoupon.couponId === 'string'
        ? tenantCoupon.couponId
        : null;
    if (!couponId) return null;

    await this.releaseExpiredReservations();

    const coupon = await this.prisma.tenantCoupon.findFirst({
      where: {
        id: couponId,
        reservedSessionId: input.sessionId,
        status: 'RESERVED',
        reservationExpiresAt: { gt: new Date() },
      },
      select: { id: true, reservationExpiresAt: true },
    });
    if (!coupon) {
      throw new BadRequestException(
        'Coupon reservation expired. Recalculate the invoice before payment.',
      );
    }
    return coupon;
  }

  async completeReservedCouponForInvoice(input: {
    sessionId: string;
    invoiceId: string;
    actorUserId?: string | null;
  }) {
    const alreadyUsed = await this.prisma.tenantCoupon.findFirst({
      where: {
        usedSessionId: input.sessionId,
        usedInvoiceId: input.invoiceId,
        status: 'USED',
      },
    });
    if (alreadyUsed) return alreadyUsed;

    return this.prisma.$transaction(async (tx: any) => {
      const coupon = await tx.tenantCoupon.findFirst({
        where: {
          reservedSessionId: input.sessionId,
          status: 'RESERVED',
        },
      });
      if (!coupon) return null;
      if (
        !coupon.reservationExpiresAt ||
        coupon.reservationExpiresAt <= new Date()
      ) {
        throw new BadRequestException('Coupon reservation has expired');
      }

      const usedAt = new Date();
      const updated = await tx.tenantCoupon.updateMany({
        where: {
          id: coupon.id,
          status: 'RESERVED',
          reservedSessionId: input.sessionId,
        },
        data: {
          status: 'USED',
          usedSessionId: input.sessionId,
          usedInvoiceId: input.invoiceId,
          usedAt,
          reservedSessionId: null,
          reservationToken: null,
          reservationExpiresAt: null,
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException('Coupon usage state changed');
      }

      await tx.tenantCouponEvent.create({
        data: {
          couponId: coupon.id,
          eventType: 'USED',
          fromStatus: 'RESERVED',
          toStatus: 'USED',
          actorUserId: input.actorUserId ?? coupon.assignedMemberUserId,
          memberUserId: coupon.assignedMemberUserId,
          parkingSessionId: input.sessionId,
          invoiceId: input.invoiceId,
          metadata: { usedAt: usedAt.toISOString() },
        },
      });

      return tx.tenantCoupon.findUnique({ where: { id: coupon.id } });
    });
  }

  async releaseReservedCouponForSession(input: {
    sessionId: string;
    actorUserId?: string | null;
    reason: string;
  }) {
    const coupon = await this.prisma.tenantCoupon.findFirst({
      where: {
        reservedSessionId: input.sessionId,
        status: 'RESERVED',
      },
    });
    if (!coupon) return null;

    await this.releaseReservedCouponById({
      couponId: coupon.id,
      actorUserId: input.actorUserId ?? coupon.assignedMemberUserId,
      reason: input.reason,
    });
    return coupon;
  }

  async releaseExpiredReservations(userId?: string) {
    const expired = await this.prisma.tenantCoupon.findMany({
      where: {
        status: 'RESERVED',
        reservationExpiresAt: { lte: new Date() },
        ...(userId ? { assignedMemberUserId: userId } : {}),
      },
      select: { id: true, assignedMemberUserId: true },
      take: 200,
    });

    for (const coupon of expired) {
      await this.releaseReservedCouponById({
        couponId: coupon.id,
        actorUserId: coupon.assignedMemberUserId,
        reason: 'RESERVATION_EXPIRED',
      });
    }
  }

  private async releaseReservedCouponById(input: {
    couponId: string;
    actorUserId?: string | null;
    reason: string;
  }) {
    return this.prisma.$transaction(async (tx: any) => {
      const coupon = await tx.tenantCoupon.findFirst({
        where: { id: input.couponId, status: 'RESERVED' },
      });
      if (!coupon) return null;

      const updated = await tx.tenantCoupon.updateMany({
        where: { id: coupon.id, status: 'RESERVED' },
        data: {
          status: 'ASSIGNED',
          reservedSessionId: null,
          reservationToken: null,
          reservationExpiresAt: null,
        },
      });
      if (updated.count !== 1) return null;

      if (coupon.reservedSessionId) {
        const invoiceIds = await tx.invoice.findMany({
          where: { sessionId: coupon.reservedSessionId },
          select: { id: true },
        });

        if (invoiceIds.length > 0) {
          await tx.payment.updateMany({
            where: {
              invoiceId: { in: invoiceIds.map((invoice: { id: string }) => invoice.id) },
              status: PaymentStatus.PENDING,
            },
            data: {
              status: PaymentStatus.CANCELLED,
              cancelledAt: new Date(),
              failureCode: `COUPON_${input.reason}`.slice(0, 100),
              failureMessage: 'Coupon reservation was released before payment completion',
            },
          });
        }
      }

      await tx.tenantCouponEvent.create({
        data: {
          couponId: coupon.id,
          eventType: 'RESERVATION_RELEASED',
          fromStatus: 'RESERVED',
          toStatus: 'ASSIGNED',
          actorUserId: input.actorUserId ?? coupon.assignedMemberUserId,
          memberUserId: coupon.assignedMemberUserId,
          parkingSessionId: coupon.reservedSessionId,
          metadata: { reason: input.reason },
        },
      });
      return coupon;
    });
  }

  private calculateCouponDiscountAmount(input: {
    benefitType: string;
    benefitValue: number;
    amountBeforeCoupon: number;
    baseParkingAmount: number;
    totalMinutes: number;
    feePolicy: any;
  }) {
    const amount = Math.max(0, input.amountBeforeCoupon);
    const value = Math.max(0, Math.floor(input.benefitValue));

    if (input.benefitType === 'FULL_WAIVER') return amount;
    if (input.benefitType === 'PERCENT') {
      return Math.min(amount, Math.floor((amount * value) / 100));
    }
    if (input.benefitType === 'FIXED_AMOUNT') {
      return Math.min(amount, value);
    }
    if (input.benefitType === 'FREE_MINUTES') {
      const reducedMinutes = Math.max(0, input.totalMinutes - value);
      const reducedBaseAmount = this.calculateBaseParkingAmount(
        reducedMinutes,
        input.feePolicy,
      );
      return Math.min(
        amount,
        Math.max(0, input.baseParkingAmount - reducedBaseAmount),
      );
    }
    throw new BadRequestException('Unsupported coupon benefit type');
  }

  private calculateBaseParkingAmount(totalMinutes: number, feePolicy: any) {
    const graceMinutes = Math.max(0, Number(feePolicy?.graceMinutes ?? 0));
    const baseMinutes = Math.max(0, Number(feePolicy?.baseMinutes ?? 0));
    const baseFee = Math.max(0, Number(feePolicy?.baseFee ?? 0));
    const unitMinutes = Math.max(1, Number(feePolicy?.unitMinutes ?? 1));
    const unitFee = Math.max(0, Number(feePolicy?.unitFee ?? 0));
    const dailyMax =
      feePolicy?.dailyMax == null ? null : Number(feePolicy.dailyMax);

    const singleDay = (minutes: number) => {
      if (minutes <= graceMinutes) return 0;
      if (minutes <= baseMinutes) return baseFee;
      const amount =
        baseFee + Math.ceil((minutes - baseMinutes) / unitMinutes) * unitFee;
      return dailyMax && dailyMax > 0 ? Math.min(amount, dailyMax) : amount;
    };

    if (dailyMax && dailyMax > 0) {
      const days = Math.floor(totalMinutes / 1440);
      return days * dailyMax + singleDay(totalMinutes % 1440);
    }
    return singleDay(totalMinutes);
  }

  private emptyCouponCalculation(amountBeforeCoupon: number) {
    const amount = Math.max(0, amountBeforeCoupon);
    return {
      couponId: null,
      codeMasked: null,
      tenantId: null,
      tenantName: null,
      productId: null,
      productCode: null,
      productName: null,
      benefitType: null,
      benefitValue: 0,
      stackableWithAutomaticDiscount: true,
      reservationExpiresAt: null,
      amountBeforeCoupon: amount,
      discountAmount: 0,
      finalAmount: amount,
    };
  }

  private serializeReservation(coupon: any) {
    if (!coupon) return null;
    return {
      id: coupon.id,
      codeMasked: coupon.codeMasked,
      status: coupon.status,
      reservationToken: coupon.reservationToken,
      reservationExpiresAt: coupon.reservationExpiresAt,
      reservedSessionId: coupon.reservedSessionId,
      tenant: coupon.tenant,
      product: coupon.product,
    };
  }

  private asRecord(value: unknown): Record<string, any> {
    return value && typeof value === 'object'
      ? (value as Record<string, any>)
      : {};
  }

  private async getContext(user: CouponAuthUser | undefined) {
    const userId = user?.sub ?? user?.id ?? null;
    if (!userId) throw new ForbiddenException('Authenticated user required');

    const dbUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tenantId: true,
        roles: { select: { role: { select: { code: true } } } },
        tenantUsers: {
          where: { status: 'ACTIVE' },
          select: { tenantId: true },
        },
        managerProfile: {
          select: {
            parkingLots: { select: { parkingLotId: true } },
          },
        },
      },
    });
    if (!dbUser) throw new ForbiddenException('User not found');

    const roles = new Set<string>();
    if (user?.role) roles.add(String(user.role).toUpperCase());
    for (const item of user?.roles ?? []) {
      if (typeof item === 'string') roles.add(item.toUpperCase());
      else {
        if (item.code) roles.add(String(item.code).toUpperCase());
        if (item.role?.code) roles.add(String(item.role.code).toUpperCase());
      }
    }
    for (const item of dbUser.roles) {
      if (item.role.code) roles.add(item.role.code.toUpperCase());
    }

    return {
      userId,
      isAdmin:
        roles.has('ADMIN') ||
        roles.has('SUPER_ADMIN') ||
        roles.has('SUPERUSER') ||
        roles.has('ROOT'),
      managerParkingLotIds: dbUser.managerProfile?.parkingLots.map(
        (item) => item.parkingLotId,
      ) ?? [],
      tenantIds: Array.from(
        new Set([
          ...(dbUser.tenantId ? [dbUser.tenantId] : []),
          ...dbUser.tenantUsers.map((item) => item.tenantId),
        ]),
      ),
    };
  }

  private async getAllowedParkingLotIds(
    context: Awaited<ReturnType<TenantCouponsService['getContext']>>,
  ) {
    const tenantLots = context.tenantIds.length
      ? await this.prisma.tenant.findMany({
          where: { id: { in: context.tenantIds } },
          select: { parkingLotId: true },
        })
      : [];

    return Array.from(
      new Set([
        ...context.managerParkingLotIds,
        ...tenantLots
          .map((item) => item.parkingLotId)
          .filter((id): id is string => Boolean(id)),
      ]),
    );
  }

  private async assertParkingLotManager(
    user: CouponAuthUser | undefined,
    parkingLotId: string,
  ) {
    const context = await this.getContext(user);
    const parkingLot = await this.prisma.parkingLot.findUnique({
      where: { id: parkingLotId },
      select: { id: true },
    });
    if (!parkingLot) throw new NotFoundException('Parking lot not found');
    if (!context.isAdmin && !context.managerParkingLotIds.includes(parkingLotId)) {
      throw new ForbiddenException('Manager parking lot access required');
    }
    return context;
  }

  private async assertTenantAccess(
    user: CouponAuthUser | undefined,
    tenantId: string,
    managerOnly = false,
  ) {
    const context = await this.getContext(user);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, code: true, parkingLotId: true, isActive: true },
    });
    if (!tenant?.isActive) throw new NotFoundException('Active tenant not found');

    const isManager =
      Boolean(tenant.parkingLotId) &&
      context.managerParkingLotIds.includes(tenant.parkingLotId as string);
    const isTenantUser = context.tenantIds.includes(tenantId);

    if (
      !context.isAdmin &&
      !(isManager || (!managerOnly && isTenantUser))
    ) {
      throw new ForbiddenException('Tenant access denied');
    }

    return { tenant, context, isManager, isTenantUser };
  }

  private async expireCoupons(tenantId: string) {
    await this.prisma.tenantCoupon.updateMany({
      where: {
        tenantId,
        status: { in: ['AVAILABLE', 'ASSIGNED'] as any },
        expiresAt: { lte: new Date() },
      },
      data: { status: 'EXPIRED' as any },
    });
  }

  private async getActiveTenantForApp(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        code: true,
        parkingLotId: true,
        isActive: true,
      },
    });

    const parkingLotId = tenant?.parkingLotId;

    if (!tenant?.isActive || !parkingLotId) {
      throw new NotFoundException('Active tenant parking lot not found');
    }

    return {
      ...tenant,
      parkingLotId,
    };
  }

  private validateBenefit(type: string, value: number) {
    if (!Number.isInteger(value) || value < 0) {
      throw new BadRequestException('Benefit value must be a non-negative integer');
    }
    if (type === 'PERCENT' && value > 100) {
      throw new BadRequestException('Percent benefit cannot exceed 100');
    }
    if (type === 'FULL_WAIVER' && value !== 0) {
      throw new BadRequestException('FULL_WAIVER benefitValue must be 0');
    }
  }

  private normalizeCode(value: string) {
    const code = String(value ?? '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '_');
    if (!code) throw new BadRequestException('Code is required');
    return code;
  }

  private generatePurchaseNo() {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `TCP-${date}-${randomBytes(5).toString('hex').toUpperCase()}`;
  }

  private buildCouponRow(input: {
    tenantId: string;
    productId: string;
    purchaseId: string;
    expiresAt: Date;
  }) {
    const id = randomUUID();
    const rawCode = this.generateCouponCode();
    const codeHash = createHmac(
      'sha256',
      process.env.COUPON_CODE_SECRET ??
        process.env.JWT_SECRET ??
        'kosmos-dev-coupon-secret',
    )
      .update(rawCode)
      .digest('hex');

    return {
      id,
      serialNo: `CPN-${randomBytes(8).toString('hex').toUpperCase()}`,
      codeHash,
      codeMasked: `${rawCode.slice(0, 4)}-****-${rawCode.slice(-4)}`,
      tenantId: input.tenantId,
      productId: input.productId,
      purchaseId: input.purchaseId,
      status: 'AVAILABLE',
      expiresAt: input.expiresAt,
    };
  }

  private generateCouponCode() {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(12);
    let value = '';
    for (const byte of bytes) value += alphabet[byte % alphabet.length];
    return value;
  }

  private addMonths(value: Date, months: number) {
    const next = new Date(value);
    next.setMonth(next.getMonth() + months);
    return next;
  }

  private maskPhone(value?: string | null) {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (digits.length < 7) return value ?? null;
    return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
  }
}
