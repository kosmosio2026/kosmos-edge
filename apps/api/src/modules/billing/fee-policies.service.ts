import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFeePolicyDto } from './dto/create-fee-policy.dto';
import { UpdateFeePolicyDto } from './dto/update-fee-policy.dto';

@Injectable()
export class FeePoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(parkingLotId?: string) {
    return this.prisma.feePolicy.findMany({
      where: parkingLotId
        ? {
            parkingLotId,
          }
        : undefined,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        parkingLot: true,
      },
    });
  }

  async getById(id: string) {
    const policy = await this.prisma.feePolicy.findUnique({
      where: { id },
      include: {
        parkingLot: true,
      },
    });

    if (!policy) {
      throw new NotFoundException('FeePolicy not found');
    }

    return policy;
  }

  async create(dto: CreateFeePolicyDto) {
    return this.prisma.feePolicy.create({
      data: {
        parkingLotId: dto.parkingLotId,
        code: dto.code,
        name: dto.name,
        vehicleType: dto.vehicleType,
        baseMinutes: dto.baseMinutes,
        baseFee: dto.baseFee,
        unitMinutes: dto.unitMinutes,
        unitFee: dto.unitFee,
        dailyMax: dto.dailyMax,
        graceMinutes: dto.graceMinutes ?? 0,
        exitGraceMinutes: dto.exitGraceMinutes ?? 10,
        registrationGraceMinutes: dto.registrationGraceMinutes ?? 10,
        registrationGraceFee: dto.registrationGraceFee ?? 0,
        registrationGraceDiscountEnabled:
          dto.registrationGraceDiscountEnabled ?? true,
        authorityRegistrationGraceDiscountEnabled:
          dto.authorityRegistrationGraceDiscountEnabled ?? false,
        watcherRewardGraceFeeEnabled:
          dto.watcherRewardGraceFeeEnabled ?? false,
        memberDiscountPercent: dto.memberDiscountPercent ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: {
        parkingLot: true,
      },
    });
  }

  async update(id: string, dto: UpdateFeePolicyDto) {
    await this.getById(id);

    return this.prisma.feePolicy.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        vehicleType: dto.vehicleType,
        baseMinutes: dto.baseMinutes,
        baseFee: dto.baseFee,
        unitMinutes: dto.unitMinutes,
        unitFee: dto.unitFee,
        dailyMax: dto.dailyMax,
        graceMinutes: dto.graceMinutes,
        exitGraceMinutes: dto.exitGraceMinutes,
        registrationGraceMinutes: dto.registrationGraceMinutes,
        registrationGraceFee: dto.registrationGraceFee,
        registrationGraceDiscountEnabled: dto.registrationGraceDiscountEnabled,
        authorityRegistrationGraceDiscountEnabled:
          dto.authorityRegistrationGraceDiscountEnabled,
        watcherRewardGraceFeeEnabled: dto.watcherRewardGraceFeeEnabled,
        memberDiscountPercent: dto.memberDiscountPercent,
        isActive: dto.isActive,
      },
      include: {
        parkingLot: true,
      },
    });
  }

  async remove(id: string) {
    await this.getById(id);

    await this.prisma.feePolicy.delete({
      where: { id },
    });

    return { ok: true };
  }
}
