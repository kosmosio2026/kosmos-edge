import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ParkingLotOperationSnapshotPublisherService } from '../facilities/common/parking-lot-operation-snapshot-publisher.service';
import { CreateParkingDiscountProgramDto } from './dto/create-parking-discount-program.dto';
import { UpdateParkingDiscountProgramDto } from './dto/update-parking-discount-program.dto';

@Injectable()
export class ParkingDiscountProgramsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshotPublisher:
      ParkingLotOperationSnapshotPublisherService,
  ) {}

  listEligibilityDefinitions() {
    return this.prisma.discountEligibilityDefinition.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }

  list(parkingLotId?: string) {
    return this.prisma.parkingDiscountProgram.findMany({
      where: parkingLotId ? { parkingLotId } : undefined,
      include: {
        eligibilityDefinition: true,
        parkingLot: { select: { id: true, name: true } },
      },
      orderBy: [
        { parkingLotId: 'asc' },
        { priority: 'asc' },
        { createdAt: 'asc' },
      ],
    });
  }

  async get(id: string) {
    const item = await this.prisma.parkingDiscountProgram.findUnique({
      where: { id },
      include: {
        eligibilityDefinition: true,
        parkingLot: { select: { id: true, name: true } },
      },
    });
    if (!item) throw new NotFoundException('Parking discount program not found');
    return item;
  }

  async create(dto: CreateParkingDiscountProgramDto) {
    this.validateBenefit(dto.benefitType, dto.benefitValue);
    const validity = this.parseValidity(dto.validFrom, dto.validUntil);

    const [parkingLot, eligibility] = await Promise.all([
      this.prisma.parkingLot.findUnique({
        where: { id: dto.parkingLotId },
        select: { id: true },
      }),
      this.prisma.discountEligibilityDefinition.findUnique({
        where: { code: this.normalizeCode(dto.eligibilityCode) },
      }),
    ]);

    if (!parkingLot) throw new NotFoundException('Parking lot not found');
    if (!eligibility?.isActive) {
      throw new BadRequestException('Active discount eligibility not found');
    }

    return this.prisma.$transaction(async (tx) => {
      const created =
        await tx.parkingDiscountProgram.create({
      data: {
        parkingLotId: dto.parkingLotId,
        eligibilityDefinitionId: eligibility.id,
        code: this.normalizeCode(dto.code),
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        benefitType: dto.benefitType as any,
        benefitValue: dto.benefitValue,
        priority: dto.priority ?? 100,
        stackable: dto.stackable ?? true,
        stackableWithCoupon: dto.stackableWithCoupon ?? true,
        maxDiscountAmount: dto.maxDiscountAmount ?? null,
        minimumPayableAmount: dto.minimumPayableAmount ?? 0,
        isActive: dto.isActive ?? true,
        ...validity,
      },
      include: {
        eligibilityDefinition: true,
        parkingLot: { select: { id: true, name: true } },
      },
        });

      await this.snapshotPublisher
        .publishForParkingLot(
          created.parkingLotId,
          tx,
        );

      return created;
    });
  }

  async update(id: string, dto: UpdateParkingDiscountProgramDto) {
    const current = await this.prisma.parkingDiscountProgram.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException('Parking discount program not found');

    const benefitType = dto.benefitType ?? String(current.benefitType);
    const benefitValue = dto.benefitValue ?? current.benefitValue;
    this.validateBenefit(benefitType, benefitValue);

    let eligibilityDefinitionId: string | undefined;
    if (dto.eligibilityCode !== undefined) {
      const eligibility =
        await this.prisma.discountEligibilityDefinition.findUnique({
          where: { code: this.normalizeCode(dto.eligibilityCode) },
        });
      if (!eligibility?.isActive) {
        throw new BadRequestException('Active discount eligibility not found');
      }
      eligibilityDefinitionId = eligibility.id;
    }

    const validity = this.parseValidity(
      dto.validFrom === undefined
        ? current.validFrom?.toISOString() ?? null
        : dto.validFrom,
      dto.validUntil === undefined
        ? current.validUntil?.toISOString() ?? null
        : dto.validUntil,
    );

    return this.prisma.$transaction(async (tx) => {
      const updated =
        await tx.parkingDiscountProgram.update({
      where: { id },
      data: {
        ...(eligibilityDefinitionId ? { eligibilityDefinitionId } : {}),
        ...(dto.code !== undefined ? { code: this.normalizeCode(dto.code) } : {}),
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
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.stackable !== undefined ? { stackable: dto.stackable } : {}),
        ...(dto.stackableWithCoupon !== undefined
          ? { stackableWithCoupon: dto.stackableWithCoupon }
          : {}),
        ...(dto.maxDiscountAmount !== undefined
          ? { maxDiscountAmount: dto.maxDiscountAmount }
          : {}),
        ...(dto.minimumPayableAmount !== undefined
          ? { minimumPayableAmount: dto.minimumPayableAmount }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...validity,
      },
      include: {
        eligibilityDefinition: true,
        parkingLot: { select: { id: true, name: true } },
      },
        });

      await this.snapshotPublisher
        .publishForParkingLot(
          updated.parkingLotId,
          tx,
        );

      return updated;
    });
  }

  async remove(id: string) {
    const existing =
      await this.prisma.parkingDiscountProgram.findUnique({
        where: { id },
      });

    if (!existing) {
      throw new NotFoundException(
        'Parking discount program not found',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.parkingDiscountProgram.delete({
        where: { id },
      });

      await this.snapshotPublisher
        .publishForParkingLot(
          existing.parkingLotId,
          tx,
        );

      return { ok: true };
    });
  }

  private normalizeCode(value: string) {
    const code = String(value ?? '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '_');
    if (!code) throw new BadRequestException('Code is required');
    return code;
  }

  private validateBenefit(type: string, value: number) {
    if (!Number.isInteger(value) || value < 0) {
      throw new BadRequestException('Benefit value must be a non-negative integer');
    }
    if (type === 'PERCENT' && value > 100) {
      throw new BadRequestException('Percent discount cannot exceed 100');
    }
    if (type === 'FULL_WAIVER' && value !== 0) {
      throw new BadRequestException('FULL_WAIVER benefitValue must be 0');
    }
  }

  private parseValidity(validFrom?: string | null, validUntil?: string | null) {
    const from = this.parseDate(validFrom, 'validFrom');
    const until = this.parseDate(validUntil, 'validUntil');
    if (from && until && from > until) {
      throw new BadRequestException('validFrom must be before validUntil');
    }
    return { validFrom: from, validUntil: until };
  }

  private parseDate(value: string | null | undefined, field: string) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`${field} must be a valid date`);
    }
    return parsed;
  }
}
