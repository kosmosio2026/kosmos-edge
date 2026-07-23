import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMyVehicleDto } from './dto/create-my-vehicle.dto';
import { UpdateMyVehicleDto } from './dto/update-my-vehicle.dto';
import { UpdateVisitorVehicleDto } from './dto/update-visitor-vehicle.dto';

@Injectable()
export class MobileVehicleService {
  constructor(private readonly prisma: PrismaService) {}

  async listMyVehicles(userId: string) {
    return this.prisma.userVehicle.findMany({
      where: { userId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
      include: {
        vehicle: {
          include: {
            eligibilityDeclarations: {
              where: { isDeclared: true },
              include: { eligibilityDefinition: true },
            },
          },
        },
      },
    });
  }

  async createMyVehicle(userId: string, dto: CreateMyVehicleDto) {
    const plateNumber = this.normalizePlateNumber(dto.plateNumber);

    return this.prisma.$transaction(async (tx) => {
      const memberProfile = await tx.memberProfile.findUnique({
        where: { userId },
      });

      if (!memberProfile) {
        throw new BadRequestException('Member profile is required');
      }

      const existingVehicle = await tx.vehicle.findUnique({
        where: { plateNumber },
        include: { userLinks: true },
      });

      if (
        existingVehicle?.userLinks.some((link) => link.userId !== userId)
      ) {
        throw new BadRequestException(
          'This plate number is already registered by another member',
        );
      }

      const currentVehicleCount = await tx.userVehicle.count({
        where: { userId },
      });
      const isPrimary = dto.isPrimary ?? currentVehicleCount === 0;

      if (isPrimary) {
        await tx.userVehicle.updateMany({
          where: { userId },
          data: { isPrimary: false },
        });
      }

      const vehicle = await tx.vehicle.upsert({
        where: { plateNumber },
        update: {
          memberProfileId: memberProfile.id,
          sizeClass: dto.sizeClass,
          powertrainType: dto.powertrainType,
          vehicleType: this.toLegacyVehicleType(dto.sizeClass),
          ownerName: dto.ownerName,
          isActive: true,
        },
        create: {
          plateNumber,
          memberProfileId: memberProfile.id,
          sizeClass: dto.sizeClass,
          powertrainType: dto.powertrainType,
          vehicleType: this.toLegacyVehicleType(dto.sizeClass),
          ownerName: dto.ownerName,
          isActive: true,
        },
      });

      await this.syncVehicleEligibilityDeclarations(
        tx,
        vehicle.id,
        dto.sizeClass,
        dto.powertrainType,
      );

      await tx.userVehicle.upsert({
        where: {
          userId_vehicleId: {
            userId,
            vehicleId: vehicle.id,
          },
        },
        update: { isPrimary },
        create: {
          userId,
          vehicleId: vehicle.id,
          isPrimary,
        },
      });

      return tx.userVehicle.findUniqueOrThrow({
        where: {
          userId_vehicleId: {
            userId,
            vehicleId: vehicle.id,
          },
        },
        include: {
          vehicle: {
            include: {
              eligibilityDeclarations: {
                where: { isDeclared: true },
                include: { eligibilityDefinition: true },
              },
            },
          },
        },
      });
    });
  }

  async deleteMyVehicle(userId: string, userVehicleId: string) {
    const link = await this.prisma.userVehicle.findFirst({
      where: {
        id: userVehicleId,
        userId,
      },
    });

    if (!link) {
      throw new NotFoundException('Vehicle link not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userVehicle.delete({
        where: { id: userVehicleId },
      });

      if (link.isPrimary) {
        const next = await tx.userVehicle.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });

        if (next) {
          await tx.userVehicle.update({
            where: { id: next.id },
            data: { isPrimary: true },
          });
        }
      }
    });

    return { ok: true };
  }

  async updateMyVehicle(
    userId: string,
    userVehicleId: string,
    dto: UpdateMyVehicleDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const link = await tx.userVehicle.findFirst({
        where: {
          id: userVehicleId,
          userId,
        },
        include: {
          vehicle: true,
        },
      });

      if (!link) {
        throw new NotFoundException('Vehicle link not found');
      }

      if (
        dto.plateNumber &&
        this.normalizePlateNumber(dto.plateNumber) !== link.vehicle.plateNumber
      ) {
        throw new BadRequestException(
          'Changing plate number is not allowed here',
        );
      }

      const sizeClass = dto.sizeClass ?? link.vehicle.sizeClass ?? 'GENERAL';
      const powertrainType =
        dto.powertrainType ?? link.vehicle.powertrainType ?? 'ICE';

      if (dto.isPrimary === true) {
        await tx.userVehicle.updateMany({
          where: { userId },
          data: { isPrimary: false },
        });
      }

      await tx.vehicle.update({
        where: { id: link.vehicleId },
        data: {
          sizeClass,
          powertrainType,
          vehicleType: this.toLegacyVehicleType(sizeClass),
          ownerName: dto.ownerName,
        },
      });

      await this.syncVehicleEligibilityDeclarations(
        tx,
        link.vehicleId,
        sizeClass,
        powertrainType,
      );

      return tx.userVehicle.update({
        where: { id: userVehicleId },
        data: {
          isPrimary: dto.isPrimary ?? link.isPrimary,
        },
        include: {
          vehicle: {
            include: {
              eligibilityDeclarations: {
                where: { isDeclared: true },
                include: { eligibilityDefinition: true },
              },
            },
          },
        },
      });
    });
  }

  async updateVisitorVehicle(
    userId: string,
    dto: UpdateVisitorVehicleDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        visitorProfile: true,
      },
    });

    if (!user?.visitorProfile) {
      throw new NotFoundException('Visitor profile not found');
    }

    return this.prisma.visitorProfile.update({
      where: { userId },
      data: {
        vehicleNo: dto.vehicleNo,
      },
    });
  }

  private normalizePlateNumber(value: string) {
    const normalized = String(value ?? '')
      .trim()
      .replace(/\s+/g, '')
      .toUpperCase();

    if (!normalized) {
      throw new BadRequestException('plateNumber is required');
    }

    return normalized;
  }

  private toLegacyVehicleType(sizeClass: string) {
    return sizeClass === 'COMPACT' ? 'COMPACT' : 'NORMAL';
  }

  /**
   * Current policy:
   * Vehicle eligibility is based only on member-declared data.
   * No government or public-network verification is performed.
   *
   * TODO:
   * Add optional external verification when an approved integration and
   * customer requirement become available.
   */
  private async syncVehicleEligibilityDeclarations(
    tx: any,
    vehicleId: string,
    sizeClass: string,
    powertrainType: string,
  ) {
    const lightCar = await this.upsertEligibilityDefinition(
      tx,
      'LIGHT_CAR',
      '경차',
      'VEHICLE',
    );
    const ev = await this.upsertEligibilityDefinition(
      tx,
      'EV',
      '전기차',
      'VEHICLE',
    );

    await this.setVehicleDeclaration(
      tx,
      vehicleId,
      lightCar.id,
      sizeClass === 'COMPACT',
    );
    await this.setVehicleDeclaration(
      tx,
      vehicleId,
      ev.id,
      powertrainType === 'EV',
    );
  }

  private async setVehicleDeclaration(
    tx: any,
    vehicleId: string,
    eligibilityDefinitionId: string,
    declared: boolean,
  ) {
    if (!declared) {
      await tx.vehicleEligibilityDeclaration.deleteMany({
        where: { vehicleId, eligibilityDefinitionId },
      });
      return;
    }

    await tx.vehicleEligibilityDeclaration.upsert({
      where: {
        vehicleId_eligibilityDefinitionId: {
          vehicleId,
          eligibilityDefinitionId,
        },
      },
      update: {
        isDeclared: true,
        source: 'MEMBER_PROFILE',
        declaredAt: new Date(),
      },
      create: {
        vehicleId,
        eligibilityDefinitionId,
        isDeclared: true,
        source: 'MEMBER_PROFILE',
      },
    });
  }

  private upsertEligibilityDefinition(
    tx: any,
    code: string,
    name: string,
    scope: 'MEMBER' | 'VEHICLE',
  ) {
    return tx.discountEligibilityDefinition.upsert({
      where: { code },
      update: { name, scope, isActive: true },
      create: { code, name, scope, isActive: true },
    });
  }
}
