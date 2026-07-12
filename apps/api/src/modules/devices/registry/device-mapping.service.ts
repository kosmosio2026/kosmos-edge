import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class DeviceMappingService {
  constructor(private readonly prisma: PrismaService) {}

  mapToSpace(
    deviceId: string,
    dto: {
      parkingLotId?: string;
      parkingSectionId?: string;
      parkingSpaceId?: string;
    },
  ) {
    return this.prisma.sensorDevice.update({
      where: { id: deviceId },
      data: {
        parkingLotId: dto.parkingLotId ?? null,
        parkingSectionId: dto.parkingSectionId ?? null,
        parkingSpaceId: dto.parkingSpaceId ?? null,
      },
    });
  }

  unmap(deviceId: string) {
    return this.prisma.sensorDevice.update({
      where: { id: deviceId },
      data: {
        parkingLotId: null,
        parkingSectionId: null,
        parkingSpaceId: null,
      },
    });
  }
}