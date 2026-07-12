import { Injectable, NotFoundException } from '@nestjs/common';
import { FaultStatus } from '@parking/db';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateDeviceFaultDto } from '../dto/create-device-fault.dto';
import { UpdateDeviceFaultDto } from '../dto/update-device-fault.dto';

@Injectable()
export class DeviceFaultsService {
  constructor(private readonly prisma: PrismaService) {}

  async listFaults() {
    return this.prisma.deviceFault.findMany({
      orderBy: [{ status: 'asc' }, { detectedAt: 'desc' }],
      include: {
        sensorDevice: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  async getFaultById(id: string) {
    const fault = await this.prisma.deviceFault.findUnique({
      where: { id },
      include: {
        sensorDevice: true,
        assignedTo: true,
      },
    });

    if (!fault) {
      throw new NotFoundException('Device fault not found');
    }

    return fault;
  }

  async createFault(dto: CreateDeviceFaultDto) {
    // 🔥 sensorDevice 조회
    const device = await this.prisma.sensorDevice.findUnique({
      where: { id: dto.sensorDeviceId },
    });

    if (!device) {
      throw new NotFoundException('Sensor device not found');
    }

    return this.prisma.deviceFault.create({
      data: {
        sensorDeviceId: device.id,
        devEui: device.devEui, // 🔥 필수
        title: dto.title,
        description: dto.description,
        code: dto.code,
        severity: dto.severity,
        status: FaultStatus.OPEN,
      },
    });
  }

  async updateFault(id: string, dto: UpdateDeviceFaultDto) {
    await this.getFaultById(id);

    const resolvedAt =
      dto.status === FaultStatus.RESOLVED ? new Date() : undefined;

    const closedAt =
      dto.status === FaultStatus.CLOSED ? new Date() : undefined;

    return this.prisma.deviceFault.update({
      where: { id },
      data: {
        severity: dto.severity,
        status: dto.status,
        assignedToUserId: dto.assignedToUserId,
        actionTaken: dto.actionTaken,
        actionResult: dto.actionResult,
        resolvedAt,
        closedAt,
      },
    });
  }
}