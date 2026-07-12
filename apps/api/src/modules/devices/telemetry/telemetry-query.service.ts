import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class TelemetryQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getLatestByDevice(type: string, devEui?: string | null) {
    if (!devEui) return null;

    if (type === 'PARKING_SENSOR') {
      const rows = await this.prisma.$queryRaw<any[]>`
        SELECT *
        FROM parking_sensor_data
        WHERE dev_eui = ${devEui}
        ORDER BY time DESC
        LIMIT 1
      `;

      return rows[0] ?? null;
    }

    if (type === 'TRACKER') {
      const rows = await this.prisma.$queryRaw<any[]>`
        SELECT *
        FROM kosmos_tracker_data
        WHERE dev_eui = ${devEui}
        ORDER BY time DESC
        LIMIT 1
      `;

      return rows[0] ?? null;
    }

    if (type === 'ENV_SENSOR') {
      const rows = await this.prisma.$queryRaw<any[]>`
        SELECT *
        FROM sensio_env_data
        WHERE dev_eui = ${devEui}
        ORDER BY time DESC
        LIMIT 1
      `;

      return rows[0] ?? null;
    }

    return null;
  }
}