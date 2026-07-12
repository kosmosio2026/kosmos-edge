import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class DeviceFaultService {
  constructor(private readonly prisma: PrismaService) {}

  listOpen() {
    return this.prisma.deviceFault.findMany({
      where: {
        status: {
          in: ['OPEN', 'IN_PROGRESS'],
        },
      },
      include: {
        sensorDevice: true,
        parkingSpace: true,
      },
      orderBy: {
        detectedAt: 'desc',
      },
    });
  }
}