import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ParkingLotOperationSnapshotPublisherService } from '../facilities/common/parking-lot-operation-snapshot-publisher.service';
import { CreateFeePolicyDto } from './dto/create-fee-policy.dto';
import { UpdateFeePolicyDto } from './dto/update-fee-policy.dto';

@Injectable()
export class FeePoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshotPublisher:
      ParkingLotOperationSnapshotPublisherService,
  ) {}

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
    return this.prisma.$transaction(async (tx) => {
      const created = await tx.feePolicy.create({
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
        taxType: dto.taxType ?? 'VAT_INCLUDED',
        memberDiscountPercent: dto.memberDiscountPercent ?? 0,
        isActive: dto.isActive ?? true,
      },
      include: {
        parkingLot: true,
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

  async update(id: string, dto: UpdateFeePolicyDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing =
        await tx.feePolicy.findUnique({
          where: { id },
        });

      if (!existing) {
        throw new NotFoundException(
          'FeePolicy not found',
        );
      }

      const updated =
        await tx.feePolicy.update({
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
            exitGraceMinutes:
              dto.exitGraceMinutes,
            registrationGraceMinutes:
              dto.registrationGraceMinutes,
            registrationGraceFee:
              dto.registrationGraceFee,
            registrationGraceDiscountEnabled:
              dto.registrationGraceDiscountEnabled,
            authorityRegistrationGraceDiscountEnabled:
              dto.authorityRegistrationGraceDiscountEnabled,
            watcherRewardGraceFeeEnabled:
              dto.watcherRewardGraceFeeEnabled,
            taxType: dto.taxType,
            memberDiscountPercent:
              dto.memberDiscountPercent,
            isActive: dto.isActive,
          },
          include: {
            parkingLot: true,
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
    return this.prisma.$transaction(async (tx) => {
      const existing =
        await tx.feePolicy.findUnique({
          where: { id },
        });

      if (!existing) {
        throw new NotFoundException(
          'FeePolicy not found',
        );
      }

      await tx.feePolicy.delete({
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
}
