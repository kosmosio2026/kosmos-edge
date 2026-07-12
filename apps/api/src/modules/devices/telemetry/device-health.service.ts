import { Injectable } from '@nestjs/common';
import { TelemetryQueryService } from './telemetry-query.service';

@Injectable()
export class DeviceHealthService {
  constructor(private readonly telemetryQuery: TelemetryQueryService) {}

  async enrich(device: any) {
    const latest = await this.telemetryQuery.getLatestByDevice(
      device.type,
      device.devEui,
    );

    if (!latest) {
      return {
        ...device,
        runtimeStatus: 'NO_DATA',
        battery: null,
        batteryVoltage: null,
        lastSeenAt: null,
      };
    }

    const lastSeenAt = latest.time ?? latest.created_at ?? null;
    const ageMs = lastSeenAt
      ? Date.now() - new Date(lastSeenAt).getTime()
      : Number.POSITIVE_INFINITY;

    return {
      ...device,
      runtimeStatus: ageMs < 1000 * 60 * 30 ? 'ONLINE' : 'OFFLINE',
      battery: latest.battery_status ?? latest.battery_state ?? null,
      batteryVoltage: latest.battery_voltage ?? null,
      lastSeenAt,
      latestTelemetry: latest,
    };
  }
}