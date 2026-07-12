import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { EdgeApiKeyGuard } from '../../common/guards/edge-api-key.guard';
import {
  CurrentEdge,
  CurrentEdgeContext,
} from '../../common/decorators/current-edge.decorator';
import { SensorIngestService } from './sensor-ingest.service';

type SensorEventDto = {
  devEui: string;
  parkingStatus?: string | number | boolean;
  occupied?: string | number | boolean;
  isOccupied?: string | number | boolean;
  gatewayId?: string;
  rssi?: number;
  snr?: number;
  batteryVoltage?: number;
  occurredAt?: string;
  raw?: Record<string, unknown>;
};

@Controller('sensor')
@UseGuards(EdgeApiKeyGuard)
export class SensorIngestController {
  constructor(private readonly sensorIngestService: SensorIngestService) {}

  @Post('events')
  ingest(
    @CurrentEdge() edge: CurrentEdgeContext,
    @Body() dto: SensorEventDto,
  ) {
    const parkingStatus =
      dto.parkingStatus ?? dto.occupied ?? dto.isOccupied;

    if (parkingStatus === undefined) {
      throw new BadRequestException(
        'parkingStatus, occupied, or isOccupied is required',
      );
    }

    return this.sensorIngestService.ingestSensorEvent(edge.edgeNodeId, {
      devEui: dto.devEui,
      parkingStatus,
      gatewayId: dto.gatewayId,
      rssi: dto.rssi,
      snr: dto.snr,
      batteryVoltage: dto.batteryVoltage,
      occurredAt: dto.occurredAt,
      raw: dto.raw,
    });
  }
}