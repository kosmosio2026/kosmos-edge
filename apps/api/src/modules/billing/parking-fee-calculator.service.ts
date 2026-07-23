import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { calculateFee } from './fee-policy.engine';
import { AutomaticDiscountService } from './automatic-discount.service';

type ParkingFeeSessionInput = {
  id?: string;
  userId?: string | null;
  entryTime?: Date | string | null;
  amount?: number | null;
  paidAmount?: number | null;
  unpaidAmount?: number | null;
  feePolicy?: any | null;
  invoice?: any | null;
  latestInvoice?: any | null;
  ParkingSpace?: {
    section?: {
      parkingLotId?: string | null;
    } | null;
  } | null;
};

export type ParkingFeeSummary = {
  parkingMinutes: number;
  billedAmount: number;
  expectedFee: number;
  estimatedFee: number;
  accruedFeeAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  feePolicyId: string | null;
  feePolicyName: string | null;
  feePolicySource: 'session' | 'parkingLot' | 'fallback';
};

@Injectable()
export class ParkingFeeCalculatorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly automaticDiscountService: AutomaticDiscountService,
  ) {}

  async summarize(session: ParkingFeeSessionInput): Promise<ParkingFeeSummary> {
    const invoice = session.latestInvoice ?? session.invoice ?? null;
    const billedAmount = Number(invoice?.amount ?? session.amount ?? 0);
    const paidAmount = Number(invoice?.paidAmount ?? session.paidAmount ?? 0);

    const explicitUnpaid =
      invoice?.unpaidAmount ?? session.unpaidAmount ?? null;

    const policyResolution = await this.resolvePolicy(session);
    const expectedFee = await this.calculateExpectedFeeWithPolicy(
      session,
      policyResolution.policy,
    );

    const unpaidAmount =
      explicitUnpaid !== null && explicitUnpaid !== undefined
        ? Number(explicitUnpaid)
        : Math.max(0, billedAmount - paidAmount);

    return {
      parkingMinutes: this.calculateParkingMinutes(session.entryTime),
      billedAmount,
      expectedFee,
      estimatedFee: expectedFee,
      accruedFeeAmount: expectedFee,
      paidAmount,
      unpaidAmount,
      feePolicyId: policyResolution.policy?.id ?? null,
      feePolicyName: policyResolution.policy?.name ?? null,
      feePolicySource: policyResolution.source,
    };
  }

  async calculateExpectedFee(session: ParkingFeeSessionInput) {
    const policyResolution = await this.resolvePolicy(session);
    return this.calculateExpectedFeeWithPolicy(session, policyResolution.policy);
  }

  private async calculateExpectedFeeWithPolicy(
    session: ParkingFeeSessionInput,
    policy: any | null,
  ) {
    const parkingMinutes = this.calculateParkingMinutes(session.entryTime);
    if (parkingMinutes <= 0) return 0;

    if (!policy) {
      return 0;
    }

    const resolvedPolicy = policy;

    const isMember = session.userId
      ? await this.isMemberUser(session.userId)
      : false;

    const expectedBeforeAutomaticDiscount = calculateFee(
      parkingMinutes,
      {
        baseMinutes: Number(resolvedPolicy.baseMinutes ?? 0),
        baseFee: Number(resolvedPolicy.baseFee ?? 0),
        unitMinutes: Number(resolvedPolicy.unitMinutes ?? 1),
        unitFee: Number(resolvedPolicy.unitFee ?? 0),
        dailyMax: Number(resolvedPolicy.dailyMax ?? 0),
        memberDiscountPercent: Number(
          resolvedPolicy.memberDiscountPercent ?? 0,
        ),
      },
      { isMember },
    );

    if (!session.id) return expectedBeforeAutomaticDiscount;

    const automaticDiscount =
      await this.automaticDiscountService.calculateForSession({
        sessionId: session.id,
        baseParkingAmount: expectedBeforeAutomaticDiscount,
        amountBeforeAutomaticDiscount: expectedBeforeAutomaticDiscount,
        totalMinutes: parkingMinutes,
        feePolicy: resolvedPolicy,
      });

    return automaticDiscount.finalAmount;
  }

  private async resolvePolicy(session: ParkingFeeSessionInput): Promise<{
    policy: any | null;
    source: 'session' | 'parkingLot' | 'fallback';
  }> {
    if (session.feePolicy) {
      return {
        policy: session.feePolicy,
        source: 'session',
      };
    }

    const parkingLotPolicy = await this.findActivePolicyForSession(session);

    if (parkingLotPolicy) {
      return {
        policy: parkingLotPolicy,
        source: 'parkingLot',
      };
    }

    return {
      policy: null,
      source: 'fallback',
    };
  }

  calculateParkingMinutes(entryTime?: Date | string | null) {
    const startedAt = entryTime ? new Date(entryTime) : null;
    if (!startedAt || Number.isNaN(startedAt.getTime())) return 0;

    return Math.max(0, Math.ceil((Date.now() - startedAt.getTime()) / 60000));
  }

  private async findActivePolicyForSession(session: ParkingFeeSessionInput) {
    const parkingLotId = session.ParkingSpace?.section?.parkingLotId ?? null;
    if (!parkingLotId) return null;

    return this.prisma.feePolicy.findFirst({
      where: {
        parkingLotId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  private async isMemberUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    return user?.roles?.some((item) => item.role.code === 'MEMBER') ?? false;
  }
}
