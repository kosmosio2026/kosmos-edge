import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ParkingLotOperationSnapshotPublisherService } from '../../facilities/common/parking-lot-operation-snapshot-publisher.service';

@Injectable()
export class DeviceMappingService {
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

  private async resolveMapping(
    tx: any,
    dto: {
      parkingLotId?: string;
      parkingSectionId?: string;
      parkingSpaceId?: string;
    },
  ) {
    if (dto.parkingSpaceId) {
      const space =
        await tx.parkingSpace.findUnique({
          where: {
            id: dto.parkingSpaceId,
          },
          select: {
            id: true,
            sectionId: true,
            section: {
              select: {
                parkingLotId: true,
              },
            },
          },
        });

      if (!space) {
        throw new NotFoundException(
          `Parking space not found: ${dto.parkingSpaceId}`,
        );
      }

      return {
        parkingLotId:
          space.section.parkingLotId,
        parkingSectionId:
          space.sectionId,
        parkingSpaceId:
          space.id,
      };
    }

    if (dto.parkingSectionId) {
      const section =
        await tx.parkingSection.findUnique({
          where: {
            id: dto.parkingSectionId,
          },
          select: {
            id: true,
            parkingLotId: true,
          },
        });

      if (!section) {
        throw new NotFoundException(
          `Parking section not found: ${dto.parkingSectionId}`,
        );
      }

      return {
        parkingLotId:
          section.parkingLotId,
        parkingSectionId:
          section.id,
        parkingSpaceId: null,
      };
    }

    if (dto.parkingLotId) {
      const lot =
        await tx.parkingLot.findUnique({
          where: {
            id: dto.parkingLotId,
          },
          select: {
            id: true,
          },
        });

      if (!lot) {
        throw new NotFoundException(
          `Parking lot not found: ${dto.parkingLotId}`,
        );
      }

      return {
        parkingLotId: lot.id,
        parkingSectionId: null,
        parkingSpaceId: null,
      };
    }

    return {
      parkingLotId: null,
      parkingSectionId: null,
      parkingSpaceId: null,
    };
  }

  private async publish(
    tx: any,
    parkingLotIds: Array<
      string | null | undefined
    >,
  ) {
    const uniqueIds = [
      ...new Set(
        parkingLotIds.filter(
          (value): value is string =>
            typeof value === 'string' &&
            value.length > 0,
        ),
      ),
    ];

    for (const parkingLotId of uniqueIds) {
      await this.snapshotPublisher
        .publishForParkingLot(
          parkingLotId,
          tx,
        );
    }
  }

  async mapToSpace(
    deviceId: string,
    dto: {
      parkingLotId?: string;
      parkingSectionId?: string;
      parkingSpaceId?: string;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing =
        await tx.sensorDevice.findUnique({
          where: {
            id: deviceId,
          },
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

      const previousParkingLotId =
        this.resolveParkingLotId(existing);

      const mapping =
        await this.resolveMapping(tx, dto);

      const updated =
        await tx.sensorDevice.update({
          where: {
            id: deviceId,
          },
          data: mapping,
          include: {
            parkingSpace: {
              include: {
                section: true,
              },
            },
          },
        });

      await this.publish(tx, [
        previousParkingLotId,
        this.resolveParkingLotId(updated),
      ]);

      return updated;
    });
  }

  async unmap(deviceId: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing =
        await tx.sensorDevice.findUnique({
          where: {
            id: deviceId,
          },
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

      const previousParkingLotId =
        this.resolveParkingLotId(existing);

      const updated =
        await tx.sensorDevice.update({
          where: {
            id: deviceId,
          },
          data: {
            /*
             * 주차면 배정만 해제하고 주차장 소속은 보존한다.
             * 그래야 센서가 해당 주차장 Snapshot에 계속 포함된다.
             */
            parkingLotId:
              previousParkingLotId,
            parkingSectionId: null,
            parkingSpaceId: null,
          },
        });

      await this.publish(
        tx,
        [previousParkingLotId],
      );

      return updated;
    });
  }
}
