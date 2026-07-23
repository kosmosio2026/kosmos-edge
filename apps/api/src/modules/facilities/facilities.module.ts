import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';

import { LotsController } from './lots/lots.controller';
import { LotsService } from './lots/lots.service';
import { SectionsController } from './sections/sections.controller';
import { SectionsService } from './sections/sections.service';
import { SpacesController } from './spaces/spaces.controller';
import { SpacesService } from './spaces/spaces.service';
import { RbacModule } from '../rbac/rbac.module';
import { ParkingLotOperationSnapshotPublisherService } from './common/parking-lot-operation-snapshot-publisher.service';


@Module({
  imports: [PrismaModule, RbacModule,],
  controllers: [LotsController, SectionsController, SpacesController],
  providers: [
    LotsService,
    SectionsService,
    SpacesService,
    ParkingLotOperationSnapshotPublisherService,
  ],
  exports: [
    LotsService,
    SectionsService,
    SpacesService,
    ParkingLotOperationSnapshotPublisherService,
  ],
})
export class FacilitiesModule {}