import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type FeePolicyLike = {
  id: string;
  parkingLotId: string;
  code?: string | null;
  name?: string | null;
  vehicleType: string;
  baseMinutes: number;
  baseFee: number;
  unitMinutes: number;
  unitFee: number;
  memberDiscountPercent: number;
  dailyMax?: number | null;
  graceMinutes: number;
  isActive: boolean;
  validFrom?: Date | null;
  validTo?: Date | null;
};

export type ParkingFeeCalculationInput = {
  parkingLotId: string;
  totalMinutes: number;
  vehicleType?: string;
  isMember?: boolean;
  now?: Date;
};

export type ParkingFeeCalculationResult = {
  policyId: string;
  policyName: string | null;
  vehicleType: string;
  totalMinutes: number;
  billableMinutes: number;
  baseAmount: number;
  extraAmount: number;
  discountAmount: number;
  totalAmount: number;
  dailyMaxApplied: boolean;
  graceMinutes: number;
  currency: 'KRW';
  breakdown: {
    baseMinutes: number;
    baseFee: number;
    unitMinutes: number;
    unitFee: number;
    dailyMax: number | null;
    memberDiscountPercent: number;
  };
};

@Injectable()
export class FeePolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async findActivePolicy(input: {
    parkingLotId: string;
    vehicleType?: string;
    now?: Date;
  }): Promise<FeePolicyLike> {
    const now = input.now ?? new Date();
    const vehicleType = input.vehicleType ?? 'GENERAL';

    const policy = await this.prisma.feePolicy.findFirst({
      where: {
        parkingLotId: input.parkingLotId,
        vehicleType,
        isActive: true,
        AND: [
          {
            OR: [{ validFrom: null }, { validFrom: { lte: now } }],
          },
          {
            OR: [{ validTo: null }, { validTo: { gte: now } }],
          },
        ],
      },
      orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
    });

    if (policy) {
      return policy;
    }

    const fallback = await this.prisma.feePolicy.findFirst({
      where: {
        parkingLotId: input.parkingLotId,
        isActive: true,
        AND: [
          {
            OR: [{ validFrom: null }, { validFrom: { lte: now } }],
          },
          {
            OR: [{ validTo: null }, { validTo: { gte: now } }],
          },
        ],
      },
      orderBy: [{ validFrom: 'desc' }, { createdAt: 'desc' }],
    });

    if (!fallback) {
      throw new Error(
        `No active fee policy found for parkingLotId=${input.parkingLotId}`,
      );
    }

    return fallback;
  }

  async calculateParkingFee(
    input: ParkingFeeCalculationInput,
  ): Promise<ParkingFeeCalculationResult> {
    const now = input.now ?? new Date();
    const totalMinutes = Math.max(0, Math.ceil(input.totalMinutes));

    const policy = await this.findActivePolicy({
      parkingLotId: input.parkingLotId,
      vehicleType: input.vehicleType,
      now,
    });

    return this.calculateWithPolicy({
      policy,
      totalMinutes,
      isMember: input.isMember ?? false,
    });
  }

  calculateWithPolicy(input: {
    policy: any;
    totalMinutes: number;
    isMember?: boolean;
  }): ParkingFeeCalculationResult {
    const { policy } = input;
    const totalMinutes = Math.max(0, Math.ceil(input.totalMinutes));

    if (totalMinutes <= 0) {
      return this.emptyResult(policy, totalMinutes);
    }

    const billableMinutes = totalMinutes;

    if (billableMinutes <= Number(policy.graceMinutes ?? 0)) {
      return {
        ...this.emptyResult(policy, totalMinutes),
        billableMinutes,
      };
    }

    const dailyMax = Number(policy.dailyMax ?? 0);
    const fullDays = dailyMax > 0 ? Math.floor(billableMinutes / 1440) : 0;
    const remainingMinutes = dailyMax > 0 ? billableMinutes % 1440 : billableMinutes;

    const calculateSingleDay = (minutes: number) => {
      if (minutes <= 0) {
        return {
          baseAmount: 0,
          extraAmount: 0,
          totalAmount: 0,
          dailyMaxApplied: false,
        };
      }

      let baseAmount = 0;
      let extraAmount = 0;

      if (minutes <= Number(policy.baseMinutes ?? 0)) {
        baseAmount = Number(policy.baseFee ?? 0);
      } else {
        baseAmount = Number(policy.baseFee ?? 0);
        const extraMinutes = minutes - Number(policy.baseMinutes ?? 0);
        const units = Math.ceil(extraMinutes / Number(policy.unitMinutes ?? 1));
        extraAmount = units * Number(policy.unitFee ?? 0);
      }

      const rawAmount = baseAmount + extraAmount;

      if (dailyMax > 0 && rawAmount > dailyMax) {
        return {
          baseAmount,
          extraAmount,
          totalAmount: dailyMax,
          dailyMaxApplied: true,
        };
      }

      return {
        baseAmount,
        extraAmount,
        totalAmount: rawAmount,
        dailyMaxApplied: false,
      };
    };

    const remaining = calculateSingleDay(remainingMinutes);
    const fullDayAmount = fullDays * dailyMax;
    const grossAmount = fullDayAmount + remaining.totalAmount;

    const discountRate =
      input.isMember === true
        ? Number(policy.memberDiscountPercent ?? 0)
        : 0;

    const discountAmount =
      discountRate > 0 ? Math.floor(grossAmount * (discountRate / 100)) : 0;

    const totalAmount = Math.max(0, grossAmount - discountAmount);

    return {
      ...this.emptyResult(policy, totalMinutes),
      totalMinutes,
      billableMinutes,
      baseAmount: fullDayAmount + remaining.baseAmount,
      extraAmount: remaining.extraAmount,
      discountAmount,
      totalAmount,
      dailyMaxApplied: fullDays > 0 || remaining.dailyMaxApplied,
    };
  }

  private emptyResult(
    policy: FeePolicyLike,
    totalMinutes: number,
  ): ParkingFeeCalculationResult {
    return {
      policyId: policy.id,
      policyName: policy.name ?? null,
      vehicleType: policy.vehicleType,
      totalMinutes,
      billableMinutes: 0,
      baseAmount: 0,
      extraAmount: 0,
      discountAmount: 0,
      totalAmount: 0,
      dailyMaxApplied: false,
      graceMinutes: policy.graceMinutes,
      currency: 'KRW',
      breakdown: {
        baseMinutes: policy.baseMinutes,
        baseFee: policy.baseFee,
        unitMinutes: policy.unitMinutes,
        unitFee: policy.unitFee,
        dailyMax: policy.dailyMax ?? null,
        memberDiscountPercent: policy.memberDiscountPercent,
      },
    };
  }
}