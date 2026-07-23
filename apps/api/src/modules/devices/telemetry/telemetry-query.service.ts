import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

function normalizeTelemetryDevEui(value: unknown) {
  return String(value ?? '').trim().replace(/[\s:-]/g, '').toUpperCase();
}


@Injectable()
export class TelemetryQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getLatestByDevice(type: string, devEui?: string | null) {
    const normalizedDevEui = normalizeTelemetryDevEui(devEui);

    if (!normalizedDevEui) return null;

    if (type === 'PARKING_SENSOR') {
      const rows = await this.prisma.$queryRaw<any[]>`
        WITH latest AS (
          SELECT *
          FROM parking_sensor_data
          WHERE upper(regexp_replace(dev_eui, '[^0-9A-Fa-f]', '', 'g')) = ${normalizedDevEui}
          ORDER BY time DESC
          LIMIT 1
        ),
        state AS (
          SELECT *
          FROM parking_state
          WHERE upper(regexp_replace(dev_eui, '[^0-9A-Fa-f]', '', 'g')) = ${normalizedDevEui}
          LIMIT 1
        )
        SELECT
          latest.id,
          COALESCE(latest.dev_eui, state.dev_eui) AS dev_eui,
          latest.gateway_id,
          COALESCE(state.last_message_time, latest.time) AS time,
          latest.dr,
          latest.fcnt,
          latest.fport,
          COALESCE(state.rssi, latest.rssi) AS rssi,
          COALESCE(state.snr, latest.snr) AS snr,
          latest.channel,
          latest.battery_status,
          COALESCE(state.battery_voltage, latest.battery_voltage) AS battery_voltage,
          latest.device_status,
          COALESCE(state.parking_status, latest.parking_status) AS parking_status,
          latest.firmware_version,
          latest.created_at,
          state.state_since,
          state.last_message_time
        FROM latest
        FULL OUTER JOIN state
          ON upper(regexp_replace(latest.dev_eui, '[^0-9A-Fa-f]', '', 'g')) = upper(regexp_replace(state.dev_eui, '[^0-9A-Fa-f]', '', 'g'))
      `;

      return rows[0] ?? null;
    }

    if (type === 'TRACKER') {
      const rows = await this.prisma.$queryRaw<any[]>`
        SELECT *
        FROM kosmos_tracker_data
        WHERE upper(regexp_replace(dev_eui, '[^0-9A-Fa-f]', '', 'g')) = ${normalizedDevEui}
        ORDER BY time DESC
        LIMIT 1
      `;

      return rows[0] ?? null;
    }

    if (type === 'ENV_SENSOR') {
      const rows = await this.prisma.$queryRaw<any[]>`
        SELECT *
        FROM sensio_env_data
        WHERE upper(regexp_replace(dev_eui, '[^0-9A-Fa-f]', '', 'g')) = ${normalizedDevEui}
        ORDER BY time DESC
        LIMIT 1
      `;

      return rows[0] ?? null;
    }

    return null;
  }
}