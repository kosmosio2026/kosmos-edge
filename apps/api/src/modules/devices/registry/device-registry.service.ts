import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class DeviceRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.sensorDevice.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  create(dto: {
    name: string;
    type: string;
    serialNumber: string;
    devEui?: string;
  }) {
    return this.prisma.sensorDevice.create({
      data: {
        name: dto.name,
        type: dto.type,
        serialNumber: dto.serialNumber,
        devEui: dto.devEui || null,
      },
    });
  }

  update(
    id: string,
    dto: {
      name?: string;
      type?: string;
      serialNumber?: string;
      devEui?: string | null;
    },
  ) {
    return this.prisma.sensorDevice.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        serialNumber: dto.serialNumber,
        devEui: dto.devEui ?? undefined,
      },
    });
  }
}