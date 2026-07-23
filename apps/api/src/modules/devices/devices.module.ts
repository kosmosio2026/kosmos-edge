import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { FacilitiesModule } from '../facilities/facilities.module';

import { PrismaModule } from '../../prisma/prisma.module';
import { RedisPublisher } from '../../common/redis/redis.publisher';

import { RealtimeModule } from '../realtime/realtime.module';
import { RbacModule } from '../rbac/rbac.module';
import { SessionsModule } from '../sessions/sessions.module';
import { InvoicesModule } from '../invoices/invoices.module';

import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

import { SensorEventsController } from './sensor-events/sensor-events.controller';
import { SensorEventsService } from './sensor-events/sensor-events.service';

import { DeviceFaultsController } from './faults/device-faults.controller';
import { DeviceFaultsService } from './faults/device-faults.service';

import { DeviceRegistryService } from './registry/device-registry.service';
import { DeviceMappingService } from './registry/device-mapping.service';

import { DeviceHealthService } from './telemetry/device-health.service';
import { TelemetryIngestService } from './telemetry/telemetry-ingest.service';
import { TelemetryQueryService } from './telemetry/telemetry-query.service';

import { OccupancyLinkService } from './occupancy/occupancy-link.service';
import { OccupancyEventService } from './occupancy/occupancy-event.service';

@Module({
  imports: [
    BillingModule,
    FacilitiesModule,
    PrismaModule,
    RealtimeModule,
    RbacModule,
    SessionsModule,
    InvoicesModule,
  ],
  controllers: [
    DevicesController,
    DeviceFaultsController,
    SensorEventsController,
  ],
  providers: [
    DevicesService,
    DeviceFaultsService,

    DeviceRegistryService,
    DeviceMappingService,

    DeviceHealthService,
    TelemetryIngestService,
    TelemetryQueryService,

    OccupancyLinkService,
    OccupancyEventService,

    SensorEventsService,
    RedisPublisher,
  ],
  exports: [
    DevicesService,
    DeviceFaultsService,

    DeviceRegistryService,
    DeviceMappingService,

    DeviceHealthService,
    TelemetryIngestService,
    TelemetryQueryService,

    OccupancyLinkService,
    OccupancyEventService,
  ],
})
export class DevicesModule {}
