import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LotsService } from '../lots/lots.service';

@Injectable()
export class ParkingLotOperationSnapshotPublisherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lotsService: LotsService,
  ) {}

  async publishForParkingLot(
    parkingLotId: string,
    tx?: any,
  ) {
    const client = tx ?? this.prisma;

    const parkingLot =
      await client.parkingLot.findUnique({
        where: {
          id: parkingLotId,
        },
      });

    if (!parkingLot) {
      throw new NotFoundException(
        `Parking lot not found for operation snapshot: ${parkingLotId}`,
      );
    }

    return this.lotsService
      .enqueueParkingLotOperationSnapshotSync(
        client,
        parkingLot,
      );
  }
}
