import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export type AutomaticDiscountApplication = {
  programId: string;
  programCode: string;
  programName: string;
  eligibilityCode: string;
  eligibilityName: string;
  eligibilityScope: 'MEMBER' | 'VEHICLE';
  benefitType: 'PERCENT' | 'FIXED_AMOUNT' | 'FREE_MINUTES' | 'FULL_WAIVER';
  benefitValue: number;
  baseAmount: number;
  discountAmount: number;
  amountAfterDiscount: number;
  appliedOrder: number;
  stackable: boolean;
  stackableWithCoupon: boolean;
};

export type AutomaticDiscountResult = {
  eligible: boolean;
  reason:
    | 'APPLIED'
    | 'NO_SESSION'
    | 'VISITOR_OR_NON_MEMBER'
    | 'NO_REGISTERED_VEHICLE'
    | 'NO_PARKING_LOT'
    | 'NO_MATCHING_PROGRAM';
  amountBeforeDiscount: number;
  totalDiscountAmount: number;
  finalAmount: number;
  applications: AutomaticDiscountApplication[];
};

type CalculateInput = {
  sessionId: string;
  baseParkingAmount: number;
  amountBeforeAutomaticDiscount: number;
  totalMinutes: number;
  feePolicy?: any | null;
  now?: Date;
};

/**
 * Current policy:
 * - Eligibility is based only on member-declared data.
 * - No government/public-network verification is performed.
 * - Visitors and unregistered vehicles are excluded.
 *
 * TODO: Add optional external verification when approved integration exists.
 */
@Injectable()
export class AutomaticDiscountService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateForSession(input: CalculateInput): Promise<AutomaticDiscountResult> {
    const amountBeforeDiscount = Math.max(
      0,
      Math.floor(Number(input.amountBeforeAutomaticDiscount ?? 0)),
    );
    const empty = (
      reason: AutomaticDiscountResult['reason'],
    ): AutomaticDiscountResult => ({
      eligible: false,
      reason,
      amountBeforeDiscount,
      totalDiscountAmount: 0,
      finalAmount: amountBeforeDiscount,
      applications: [],
    });

    const session = await this.prisma.parkingSession.findUnique({
      where: { id: input.sessionId },
      include: {
        user: {
          include: {
            roles: { include: { role: true } },
            memberProfile: {
              include: {
                eligibilityDeclarations: {
                  where: { isDeclared: true },
                  include: { eligibilityDefinition: true },
                },
              },
            },
          },
        },
        vehicle: {
          include: {
            userLinks: true,
            eligibilityDeclarations: {
              where: { isDeclared: true },
              include: { eligibilityDefinition: true },
            },
          },
        },
        ParkingSpace: { include: { section: true } },
      },
    });

    if (!session) return empty('NO_SESSION');

    const isMember =
      Boolean(session.userId) &&
      (session.user?.roles?.some((item) => item.role.code === 'MEMBER') ?? false);
    if (!isMember || !session.user?.memberProfile) {
      return empty('VISITOR_OR_NON_MEMBER');
    }

    const vehicle =
      session.vehicle ??
      (session.plateNumber
        ? await this.prisma.vehicle.findUnique({
            where: { plateNumber: session.plateNumber },
            include: {
              userLinks: true,
              eligibilityDeclarations: {
                where: { isDeclared: true },
                include: { eligibilityDefinition: true },
              },
            },
          })
        : null);

    const vehicleBelongsToMember =
      Boolean(vehicle) &&
      (vehicle?.userLinks?.some((item) => item.userId === session.userId) ||
        vehicle?.memberProfileId === session.user.memberProfile.id);
    if (!vehicle || !vehicleBelongsToMember) {
      return empty('NO_REGISTERED_VEHICLE');
    }

    const parkingLotId = session.ParkingSpace?.section?.parkingLotId ?? null;
    if (!parkingLotId) return empty('NO_PARKING_LOT');

    const now = input.now ?? new Date();
    const programs = await this.prisma.parkingDiscountProgram.findMany({
      where: {
        parkingLotId,
        isActive: true,
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
          { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
        ],
      },
      include: { eligibilityDefinition: true },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });

    const memberCodes = new Set(
      session.user.memberProfile.eligibilityDeclarations
        .filter((item) => this.isActiveDeclaration(item, now))
        .map((item) => item.eligibilityDefinition.code),
    );
    const vehicleCodes = new Set(
      vehicle.eligibilityDeclarations
        .filter((item) => this.isActiveDeclaration(item, now))
        .map((item) => item.eligibilityDefinition.code),
    );

    // Customer-entered vehicle fields are also self-declarations.
    if (String(vehicle.sizeClass ?? '').toUpperCase() === 'COMPACT') {
      vehicleCodes.add('LIGHT_CAR');
    }
    if (String(vehicle.powertrainType ?? '').toUpperCase() === 'EV') {
      vehicleCodes.add('EV');
    }

    let remainingAmount = amountBeforeDiscount;
    let priorAllowsStacking = true;
    const applications: AutomaticDiscountApplication[] = [];

    for (const program of programs) {
      const definition = program.eligibilityDefinition;
      const matches =
        definition.scope === 'MEMBER'
          ? memberCodes.has(definition.code)
          : vehicleCodes.has(definition.code);
      if (!matches) continue;

      if (applications.length > 0 && (!priorAllowsStacking || !program.stackable)) {
        continue;
      }

      const discountAmount = this.calculateProgramDiscount({
        program,
        baseParkingAmount: input.baseParkingAmount,
        currentAmount: remainingAmount,
        totalMinutes: input.totalMinutes,
        feePolicy: input.feePolicy,
      });
      if (discountAmount <= 0) continue;

      remainingAmount = Math.max(0, remainingAmount - discountAmount);
      applications.push({
        programId: program.id,
        programCode: program.code,
        programName: program.name,
        eligibilityCode: definition.code,
        eligibilityName: definition.name,
        eligibilityScope: definition.scope as 'MEMBER' | 'VEHICLE',
        benefitType: program.benefitType as AutomaticDiscountApplication['benefitType'],
        benefitValue: program.benefitValue,
        baseAmount: amountBeforeDiscount,
        discountAmount,
        amountAfterDiscount: remainingAmount,
        appliedOrder: applications.length + 1,
        stackable: program.stackable,
        stackableWithCoupon: program.stackableWithCoupon,
      });

      priorAllowsStacking = program.stackable;
      if (!program.stackable || remainingAmount <= 0) break;
    }

    const totalDiscountAmount = applications.reduce(
      (sum, item) => sum + item.discountAmount,
      0,
    );

    return {
      eligible: applications.length > 0,
      reason: applications.length > 0 ? 'APPLIED' : 'NO_MATCHING_PROGRAM',
      amountBeforeDiscount,
      totalDiscountAmount,
      finalAmount: remainingAmount,
      applications,
    };
  }

  async replaceSessionSnapshots(input: {
    sessionId: string;
    invoiceId: string | null;
    result: AutomaticDiscountResult;
  }) {
    await this.prisma.$transaction(async (tx) => {
      await tx.parkingSessionDiscount.deleteMany({
        where: {
          sessionId: input.sessionId,
          source: 'AUTOMATIC_ELIGIBILITY',
        },
      });

      if (input.result.applications.length === 0) return;

      await tx.parkingSessionDiscount.createMany({
        data: input.result.applications.map((item) => ({
          sessionId: input.sessionId,
          invoiceId: input.invoiceId,
          programId: item.programId,
          source: 'AUTOMATIC_ELIGIBILITY' as any,
          eligibilityCodeSnapshot: item.eligibilityCode,
          programCodeSnapshot: item.programCode,
          programNameSnapshot: item.programName,
          benefitTypeSnapshot: item.benefitType,
          benefitValueSnapshot: item.benefitValue,
          baseAmount: item.baseAmount,
          discountAmount: item.discountAmount,
          appliedOrder: item.appliedOrder,
          metadata: {
            eligibilityName: item.eligibilityName,
            eligibilityScope: item.eligibilityScope,
            amountAfterDiscount: item.amountAfterDiscount,
            stackable: item.stackable,
            stackableWithCoupon: item.stackableWithCoupon,
            eligibilitySource: 'MEMBER_DECLARATION',
            externalVerificationPerformed: false,
          } as any,
        })),
      });
    });
  }

  private isActiveDeclaration(
    declaration: { validFrom?: Date | null; validUntil?: Date | null },
    now: Date,
  ) {
    if (declaration.validFrom && declaration.validFrom > now) return false;
    if (declaration.validUntil && declaration.validUntil < now) return false;
    return true;
  }

  private calculateProgramDiscount(input: {
    program: {
      benefitType: string;
      benefitValue: number;
      maxDiscountAmount: number | null;
      minimumPayableAmount: number;
    };
    baseParkingAmount: number;
    currentAmount: number;
    totalMinutes: number;
    feePolicy?: any | null;
  }) {
    const currentAmount = Math.max(0, Math.floor(input.currentAmount));
    if (currentAmount <= 0) return 0;

    let candidate = 0;
    switch (String(input.program.benefitType)) {
      case 'PERCENT':
        candidate = Math.floor(
          currentAmount *
            (Math.min(100, Math.max(0, input.program.benefitValue)) / 100),
        );
        break;
      case 'FIXED_AMOUNT':
        candidate = Math.max(0, input.program.benefitValue);
        break;
      case 'FREE_MINUTES': {
        const adjustedMinutes = Math.max(
          0,
          input.totalMinutes - Math.max(0, input.program.benefitValue),
        );
        const adjustedBaseAmount = this.calculateBaseParkingAmount(
          adjustedMinutes,
          input.feePolicy,
        );
        candidate = Math.max(
          0,
          Math.floor(input.baseParkingAmount) - adjustedBaseAmount,
        );
        break;
      }
      case 'FULL_WAIVER':
        candidate = currentAmount;
        break;
    }

    if (input.program.maxDiscountAmount !== null) {
      candidate = Math.min(candidate, input.program.maxDiscountAmount);
    }

    const maximumAllowedDiscount = Math.max(
      0,
      currentAmount - Math.max(0, input.program.minimumPayableAmount),
    );
    return Math.max(
      0,
      Math.min(currentAmount, maximumAllowedDiscount, Math.floor(candidate)),
    );
  }

  private calculateBaseParkingAmount(totalMinutes: number, feePolicy: any) {
    if (!feePolicy) return 0;

    const graceMinutes = Math.max(0, Number(feePolicy.graceMinutes ?? 0));
    const baseMinutes = Math.max(0, Number(feePolicy.baseMinutes ?? 0));
    const baseFee = Math.max(0, Number(feePolicy.baseFee ?? 0));
    const unitMinutes = Math.max(1, Number(feePolicy.unitMinutes ?? 1));
    const unitFee = Math.max(0, Number(feePolicy.unitFee ?? 0));
    const dailyMax = feePolicy.dailyMax == null ? null : Number(feePolicy.dailyMax);

    const singleDay = (minutes: number) => {
      if (minutes <= graceMinutes) return 0;
      if (minutes <= baseMinutes) return baseFee;
      const amount =
        baseFee + Math.ceil((minutes - baseMinutes) / unitMinutes) * unitFee;
      return dailyMax !== null && dailyMax > 0
        ? Math.min(amount, dailyMax)
        : amount;
    };

    const minutes = Math.max(0, Math.ceil(totalMinutes));
    if (dailyMax !== null && dailyMax > 0) {
      const fullDays = Math.floor(minutes / 1440);
      const remainingMinutes = minutes % 1440;
      return fullDays * dailyMax + singleDay(remainingMinutes);
    }
    return singleDay(minutes);
  }
}
