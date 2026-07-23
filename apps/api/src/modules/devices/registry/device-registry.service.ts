import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ParkingLotOperationSnapshotPublisherService } from '../../facilities/common/parking-lot-operation-snapshot-publisher.service';

@Injectable()
export class DeviceRegistryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshotPublisher:
      ParkingLotOperationSnapshotPublisherService,
  ) {}

  private resolveParkingLotId(sensor: any): string | null {
    return (
      sensor?.parkingSpace?.section?.parkingLotId ??
      sensor?.parkingLotId ??
      null
    );
  }

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

  async update(
    id: string,
    dto: {
      name?: string;
      type?: string;
      serialNumber?: string;
      devEui?: string | null;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing =
        await tx.sensorDevice.findUnique({
          where: { id },
          include: {
            parkingSpace: {
              include: {
                section: true,
              },
            },
          },
        });

      if (!existing) {
        throw new NotFoundException(
          'Sensor device not found',
        );
      }

      const updated =
        await tx.sensorDevice.update({
          where: { id },
          data: {
            name: dto.name,
            type: dto.type,
            serialNumber: dto.serialNumber,
            devEui: dto.devEui ?? undefined,
          },
        });

      const parkingLotId =
        this.resolveParkingLotId(existing);

      if (parkingLotId) {
        await this.snapshotPublisher
          .publishForParkingLot(
            parkingLotId,
            tx,
          );
      }

      return updated;
    });
  }
}
