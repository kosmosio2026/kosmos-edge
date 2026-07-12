export type ServiceHealthStatus = 'UP' | 'DOWN' | 'WARN';

export class ServiceHealthItemDto {
  service!: string;
  status!: ServiceHealthStatus;
  detail!: string;
  updatedAt!: string;
  responseTimeMs?: number;
  uptimeSec?: number;
  source?: 'http' | 'docker' | 'internal';
}

export class CertificateStatusItemDto {
  name!: string;
  host!: string;
  validTo!: string | null;
  daysRemaining!: number | null;
  status!: ServiceHealthStatus;
  detail!: string;
}

export class RuntimeDependencyStatusDto {
  name!: string;
  status!: ServiceHealthStatus;
  detail!: string;
  updatedAt!: string;
}

export class DisplayHeartbeatItemDto {
  deviceId!: string;
  lotName?: string | null;
  sectionName?: string | null;
  lastHeartbeatAt!: string | null;
  secondsSinceLastHeartbeat!: number | null;
  status!: ServiceHealthStatus;
}

export class SystemStatusResponseDto {
  services!: ServiceHealthItemDto[];
  certificates!: CertificateStatusItemDto[];
  dependencies!: RuntimeDependencyStatusDto[];
  displayHeartbeats!: DisplayHeartbeatItemDto[];
}