import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantCouponsService } from '../tenants/tenant-coupons.service';

@Injectable()
export class MobileCouponService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantCouponsService: TenantCouponsService,
  ) {}

  reserveMyCoupon(userId: string, couponId: string, sessionId: string) {
    return this.tenantCouponsService.reserveCouponForSession({
      userId,
      couponId,
      sessionId,
    });
  }

  releaseMyCoupon(
    userId: string,
    couponId: string,
    sessionId?: string,
  ) {
    return this.tenantCouponsService.releaseCouponReservation({
      userId,
      couponId,
      sessionId,
    });
  }

  async listMyCoupons(userId: string, parkingLotId?: string) {
    const now = new Date();

    await this.tenantCouponsService.releaseExpiredReservations(userId);

    await this.prisma.tenantCoupon.updateMany({
      where: {
        assignedMemberUserId: userId,
        status: 'ASSIGNED' as any,
        expiresAt: { lte: now },
      },
      data: { status: 'EXPIRED' as any },
    });

    const coupons = await this.prisma.tenantCoupon.findMany({
      where: {
        assignedMemberUserId: userId,
        status: { in: ['ASSIGNED', 'RESERVED'] as any },
        expiresAt: { gt: now },
        product: {
          isActive: true,
          ...(parkingLotId ? { parkingLotId } : {}),
        },
      },
      include: {
        product: {
          include: {
            parkingLot: { select: { id: true, name: true, code: true } },
          },
        },
        tenant: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ expiresAt: 'asc' }, { assignedAt: 'desc' }],
    });

    return coupons.map((coupon) => ({
      id: coupon.id,
      codeMasked: coupon.codeMasked,
      status: coupon.status,
      assignedAt: coupon.assignedAt,
      reservedSessionId: coupon.reservedSessionId,
      reservationExpiresAt: coupon.reservationExpiresAt,
      expiresAt: coupon.expiresAt,
      tenant: coupon.tenant,
      product: {
        id: coupon.product.id,
        code: coupon.product.code,
        name: coupon.product.name,
        description: coupon.product.description,
        benefitType: coupon.product.benefitType,
        benefitValue: coupon.product.benefitValue,
        stackableWithAutomaticDiscount:
          coupon.product.stackableWithAutomaticDiscount,
        parkingLot: coupon.product.parkingLot,
      },
    }));
  }
}
