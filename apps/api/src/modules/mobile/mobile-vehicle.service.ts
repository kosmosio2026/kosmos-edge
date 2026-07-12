import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
        vehicle: true,
      },
    });
  }

  async createMyVehicle(userId: string, dto: CreateMyVehicleDto) {
    const vehicle = await this.prisma.vehicle.upsert({
      where: { plateNumber: dto.plateNumber },
      update: {
        vehicleType: dto.vehicleType,
        ownerName: dto.ownerName,
        isActive: true,
      },
      create: {
        plateNumber: dto.plateNumber,
        vehicleType: dto.vehicleType,
        ownerName: dto.ownerName,
        isActive: true,
      },
    });

    if (dto.isPrimary) {
      await this.prisma.userVehicle.updateMany({
        where: { userId },
        data: { isPrimary: false },
      });
    }

    return this.prisma.userVehicle.upsert({
      where: {
        userId_vehicleId: {
          userId,
          vehicleId: vehicle.id,
        },
      },
      update: {
        isPrimary: dto.isPrimary ?? false,
      },
      create: {
        userId,
        vehicleId: vehicle.id,
        isPrimary: dto.isPrimary ?? false,
      },
      include: {
        vehicle: true,
      },
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

    await this.prisma.userVehicle.delete({
      where: { id: userVehicleId },
    });

    return { ok: true };
  }

  async updateMyVehicle(userId: string, userVehicleId: string, dto: UpdateMyVehicleDto) {
    const link = await this.prisma.userVehicle.findFirst({
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

    if (dto.plateNumber && dto.plateNumber !== link.vehicle.plateNumber) {
      throw new BadRequestException('Changing plate number is not allowed here');
    }

    if (dto.isPrimary) {
      await this.prisma.userVehicle.updateMany({
        where: { userId },
        data: { isPrimary: false },
      });
    }

    await this.prisma.vehicle.update({
      where: { id: link.vehicleId },
      data: {
        vehicleType: dto.vehicleType,
        ownerName: dto.ownerName,
      },
    });

    return this.prisma.userVehicle.update({
      where: { id: userVehicleId },
      data: {
        isPrimary: dto.isPrimary,
      },
      include: {
        vehicle: true,
      },
    });
  }

  async updateVisitorVehicle(userId: string, dto: UpdateVisitorVehicleDto) {
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
}