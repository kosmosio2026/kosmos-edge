import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type HealthStatus = 'UP' | 'WARN' | 'DOWN';

type ServiceStatusItem = {
  service: string;
  status: HealthStatus;
  detail: string;
  updatedAt: string;
  responseTimeMs: number | null;
  uptimeSec: number | null;
  source: 'http' | 'process' | 'internal';
};

type CertificateStatusItem = {
  name: string;
  host: string;
  validTo: string | null;
  daysRemaining: number | null;
  status: HealthStatus;
  detail: string;
};

type DependencyStatusItem = {
  name: string;
  status: HealthStatus;
  detail: string;
  updatedAt: string;
};

type DisplayHeartbeatItem = {
  deviceId: string;
  displayName: string;
  lotName: string | null;
  lastHeartbeatAt: string | null;
  secondsSinceLastHeartbeat: number | null;
  status: HealthStatus;
  detail: string;
};

@Injectable()
export class SystemStatusService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Controller 호환용 alias
   */
  getStatus() {
    return this.getSystemStatus();
  }

  async getSystemStatus() {
    const now = new Date();

    const [dbDependency, displayBoards] = await Promise.all([
      this.checkDatabase(now),
      this.prisma.displayBoard.findMany({
        include: {
          parkingLot: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    const displayHeartbeats: DisplayHeartbeatItem[] = displayBoards.map((row) => {
      const lastHeartbeatAt = row.lastHeartbeatAt ?? null;
      const secondsSinceLastHeartbeat = lastHeartbeatAt
        ? Math.max(
            0,
            Math.floor((now.getTime() - lastHeartbeatAt.getTime()) / 1000),
          )
        : null;

      let status: HealthStatus = 'DOWN';
      let detail = 'No heartbeat';

      if (secondsSinceLastHeartbeat !== null) {
        if (secondsSinceLastHeartbeat <= 30) {
          status = 'UP';
          detail = 'Heartbeat healthy';
        } else if (secondsSinceLastHeartbeat <= 120) {
          status = 'WARN';
          detail = 'Heartbeat delayed';
        } else {
          status = 'DOWN';
          detail = 'Heartbeat stale';
        }
      }

      if (String(row.lastStatus) === 'ERROR') {
        status = 'DOWN';
        detail = row.lastError ?? 'Display reported error';
      }

      return {
        deviceId: row.deviceId ?? row.id,
        displayName: row.name,
        lotName: row.parkingLot?.name ?? null,
        lastHeartbeatAt: lastHeartbeatAt?.toISOString() ?? null,
        secondsSinceLastHeartbeat,
        status,
        detail,
      };
    });

    const services: ServiceStatusItem[] = [
      {
        service: 'Backend API',
        status: 'UP',
        detail: 'Process reachable',
        updatedAt: now.toISOString(),
        responseTimeMs: null,
        uptimeSec: null,
        source: 'internal',
      },
    ];

    const certificates: CertificateStatusItem[] = await this.loadCertificates(now);

    return {
      services,
      certificates,
      dependencies: [dbDependency],
      displayHeartbeats,
    };
  }

  private async checkDatabase(now: Date): Promise<DependencyStatusItem> {
    const started = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const elapsed = Date.now() - started;

      return {
        name: 'PostgreSQL',
        status: 'UP',
        detail: `Connected (${elapsed} ms)`,
        updatedAt: now.toISOString(),
      };
    } catch (error) {
      return {
        name: 'PostgreSQL',
        status: 'DOWN',
        detail:
          error instanceof Error ? error.message : 'Database connection failed',
        updatedAt: now.toISOString(),
      };
    }
  }

  private async loadCertificates(now: Date): Promise<CertificateStatusItem[]> {
    const configured = (process.env.SYSTEM_CERT_TARGETS ?? '')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    if (configured.length === 0) {
      return [];
    }

    return configured.map((entry) => {
      // 형식: name|host|validToISO
      const [name, host, validToRaw] = entry.split('|').map((v) => v.trim());
      const validTo = validToRaw ? new Date(validToRaw) : null;

      if (!name || !host || !validTo || Number.isNaN(validTo.getTime())) {
        return {
          name: name || 'Unknown certificate',
          host: host || '-',
          validTo: null,
          daysRemaining: null,
          status: 'WARN' as HealthStatus,
          detail: 'Certificate config invalid',
        };
      }

      const diffMs = validTo.getTime() - now.getTime();
      const daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      let status: HealthStatus = 'UP';
      let detail = 'Certificate valid';

      if (daysRemaining < 0) {
        status = 'DOWN';
        detail = 'Certificate expired';
      } else if (daysRemaining <= 7) {
        status = 'DOWN';
        detail = 'Certificate expires within 7 days';
      } else if (daysRemaining <= 30) {
        status = 'WARN';
        detail = 'Certificate expires within 30 days';
      }

      return {
        name,
        host,
        validTo: validTo.toISOString(),
        daysRemaining,
        status,
        detail,
      };
    });
  }
}