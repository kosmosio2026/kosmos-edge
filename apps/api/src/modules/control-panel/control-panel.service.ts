import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

import { PrismaService } from '../../prisma/prisma.service';

const execFileAsync = promisify(execFile);

type ServiceAction = 'start' | 'stop' | 'restart';
type CommandType = 'systemctl' | 'pm2';

type ServiceStatus = {
  id?: string;
  key: string;
  label: string;
  name: string;
  description?: string | null;
  host?: string | null;
  port?: number | null;
  commandType: CommandType;
  targetName: string;
  enabled: boolean;
  sortOrder?: number;
  status: 'online' | 'offline' | 'unknown' | 'disabled';
  raw?: string;
  checkedAt: string;
};

const DEFAULT_SERVICES = [
  {
    id: 'control_api',
    key: 'api',
    name: 'Cloud API',
    description: 'NestJS Cloud API 서비스',
    host: 'localhost',
    port: 3000,
    commandType: 'systemctl',
    targetName: process.env.CONTROL_PANEL_API_SERVICE ?? 'kosmos-cloud-api',
    enabled: true,
    sortOrder: 10,
  },
  {
    id: 'control_web',
    key: 'web',
    name: 'Edge Web',
    description: 'Next.js Web Console 서비스',
    host: 'localhost',
    port: 4000,
    commandType: 'systemctl',
    targetName: process.env.CONTROL_PANEL_WEB_SERVICE ?? 'kosmos-edge-web',
    enabled: true,
    sortOrder: 20,
  },
  {
    id: 'control_rust_daemon',
    key: 'rust-daemon',
    name: 'Rust Daemon',
    description: 'MQTT/센서 처리 Rust daemon',
    host: 'localhost',
    port: null,
    commandType: 'systemctl',
    targetName:
      process.env.CONTROL_PANEL_RUST_DAEMON_SERVICE ?? 'kosmos-rust-daemon',
    enabled: true,
    sortOrder: 30,
  },
  {
    id: 'control_chirpstack',
    key: 'chirpstack',
    name: 'ChirpStack',
    description: 'LoRaWAN Network Server',
    host: 'localhost',
    port: null,
    commandType: 'systemctl',
    targetName: process.env.CONTROL_PANEL_CHIRPSTACK_SERVICE ?? 'chirpstack',
    enabled: true,
    sortOrder: 40,
  },
  {
    id: 'control_websocket',
    key: 'websocket',
    name: 'WebSocket',
    description: '실시간 알림 WebSocket 서비스',
    host: 'localhost',
    port: null,
    commandType: 'systemctl',
    targetName:
      process.env.CONTROL_PANEL_WEBSOCKET_SERVICE ?? 'kosmos-websocket',
    enabled: true,
    sortOrder: 50,
  },
] as const;

@Injectable()
export class ControlPanelService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus() {
    const services = await this.getServicesWithStatus();

    return {
      ok: true,
      checkedAt: new Date().toISOString(),
      services,
      hardware: {
        displays: [],
        message: '전광판 하드웨어 어댑터는 아직 연결되지 않았습니다.',
      },
      health: {
        api: 'ok',
        serviceCount: services.length,
      },
    };
  }

  async listServices() {
    const services = await this.findConfiguredServices();

    return {
      ok: true,
      items: services,
    };
  }

  async createService(input: any) {
    const data = this.normalizeServiceInput(input, true);

    const created = await this.prisma.controlService.create({
      data: data as any,
    });

    return {
      ok: true,
      item: created,
    };
  }

  async updateService(id: string, input: any) {
    await this.ensureServiceExists(id);

    const data = this.normalizeServiceInput(input, false);

    const updated = await this.prisma.controlService.update({
      where: { id },
      data: data as any,
    });

    return {
      ok: true,
      item: updated,
    };
  }

  async removeService(id: string) {
    await this.ensureServiceExists(id);

    await this.prisma.controlService.delete({
      where: { id },
    });

    return {
      ok: true,
      id,
    };
  }

  async serviceAction(serviceIdOrKey: string, action: ServiceAction) {
    if (!['start', 'stop', 'restart'].includes(action)) {
      throw new BadRequestException('지원하지 않는 서비스 제어 명령입니다.');
    }

    const service = await this.findServiceByIdOrKey(serviceIdOrKey);

    if (!service) {
      throw new NotFoundException(`서비스를 찾을 수 없습니다: ${serviceIdOrKey}`);
    }

    if (!service.enabled) {
      return {
        ok: false,
        service: service.key,
        action,
        message: '비활성화된 서비스는 제어할 수 없습니다.',
      };
    }

    this.validateCommandTarget(service.commandType as CommandType, service.targetName);

    try {
      await this.executeServiceAction(
        service.commandType as CommandType,
        service.targetName,
        action,
      );

      const status = await this.getServiceStatus(service);

      return {
        ok: true,
        service: service.key,
        action,
        status,
      };
    } catch (error) {
      return {
        ok: false,
        service: service.key,
        action,
        message:
          error instanceof Error
            ? error.message
            : '서비스 제어에 실패했습니다.',
      };
    }
  }

  async getServiceLogs(serviceIdOrKey: string, lines = 120) {
    const service = await this.findServiceByIdOrKey(serviceIdOrKey);

    if (!service) {
      throw new NotFoundException(`서비스를 찾을 수 없습니다: ${serviceIdOrKey}`);
    }

    const safeLines = Math.min(Math.max(Number(lines) || 120, 10), 500);
    const commandType = service.commandType as CommandType;

    this.validateCommandTarget(commandType, service.targetName);

    try {
      if (commandType === 'pm2') {
        const { stdout, stderr } = await execFileAsync(
          'pm2',
          ['logs', service.targetName, '--lines', String(safeLines), '--nostream'],
          {
            timeout: 8000,
            maxBuffer: 1024 * 1024,
          },
        );

        return {
          ok: true,
          service: service.key,
          targetName: service.targetName,
          commandType,
          lines: safeLines,
          logs: [stdout, stderr].filter(Boolean).join('\n'),
        };
      }

      const { stdout, stderr } = await execFileAsync(
        'journalctl',
        ['-u', service.targetName, '-n', String(safeLines), '--no-pager'],
        {
          timeout: 8000,
          maxBuffer: 1024 * 1024,
        },
      );

      return {
        ok: true,
        service: service.key,
        targetName: service.targetName,
        commandType,
        lines: safeLines,
        logs: [stdout, stderr].filter(Boolean).join('\n'),
      };
    } catch (error) {
      return {
        ok: false,
        service: service.key,
        targetName: service.targetName,
        commandType,
        lines: safeLines,
        message:
          error instanceof Error
            ? error.message
            : '서비스 로그를 불러오지 못했습니다.',
        logs: '',
      };
    }
  }

  async sendDisplayMessage(input: { displayId?: string; message: string }) {
    return {
      ok: true,
      simulated: true,
      message:
        '전광판 메시지 제어 API는 준비되었지만 하드웨어 어댑터는 아직 연결되지 않았습니다.',
      payload: input,
    };
  }

  async setDisplayPower(input: {
    displayId?: string;
    power: 'on' | 'off' | 'reboot';
  }) {
    return {
      ok: true,
      simulated: true,
      message:
        '전광판 전원 제어 API는 준비되었지만 하드웨어 어댑터는 아직 연결되지 않았습니다.',
      payload: input,
    };
  }

  private async getServicesWithStatus() {
    const services = await this.findConfiguredServices();

    return Promise.all(services.map((service) => this.getServiceStatus(service)));
  }

  private async findConfiguredServices() {
    try {
      const rows = await this.prisma.controlService.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });

      if (rows.length > 0) return rows;
    } catch {
      // DB table may not exist during early deployment.
    }

    return DEFAULT_SERVICES.map((item) => ({
      ...item,
      port: item.port ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }

  private async findServiceByIdOrKey(serviceIdOrKey: string) {
    const service = await this.prisma.controlService.findFirst({
      where: {
        OR: [{ id: serviceIdOrKey }, { key: serviceIdOrKey }],
      },
    });

    if (service) return service;

    return DEFAULT_SERVICES.find(
      (item) => item.id === serviceIdOrKey || item.key === serviceIdOrKey,
    );
  }

  private async ensureServiceExists(id: string) {
    const found = await this.prisma.controlService.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!found) {
      throw new NotFoundException('서비스를 찾을 수 없습니다.');
    }
  }

  private normalizeServiceInput(input: any, creating: boolean) {
    const name = this.cleanString(input?.name);
    const key = this.cleanString(input?.key);
    const targetName = this.cleanString(input?.targetName);
    const commandType = this.cleanString(input?.commandType ?? 'systemctl');

    if (creating && !name) {
      throw new BadRequestException('서비스명을 입력하세요.');
    }

    if (creating && !targetName) {
      throw new BadRequestException('실행 대상을 입력하세요.');
    }

    if (commandType && !['systemctl', 'pm2'].includes(commandType)) {
      throw new BadRequestException('명령 타입은 systemctl 또는 pm2만 가능합니다.');
    }

    if (targetName) {
      this.validateCommandTarget(commandType as CommandType, targetName);
    }

    const data: Record<string, any> = {};

    if (key !== undefined) data.key = key || this.slugify(name);
    if (name !== undefined) data.name = name;
    if (input?.description !== undefined) {
      data.description = this.cleanNullableString(input.description);
    }
    if (input?.host !== undefined) {
      data.host = this.cleanNullableString(input.host);
    }
    if (input?.port !== undefined) {
      data.port =
        input.port === null || input.port === ''
          ? null
          : Number(input.port);
    }
    if (commandType !== undefined) data.commandType = commandType;
    if (targetName !== undefined) data.targetName = targetName;
    if (input?.enabled !== undefined) data.enabled = Boolean(input.enabled);
    if (input?.sortOrder !== undefined) data.sortOrder = Number(input.sortOrder);

    if (creating) {
      data.key = data.key || this.slugify(name);
      data.commandType = data.commandType || 'systemctl';
      data.enabled = input?.enabled === undefined ? true : Boolean(input.enabled);
      data.sortOrder =
        input?.sortOrder === undefined ? 100 : Number(input.sortOrder);
    }

    return data;
  }

  private async getServiceStatus(service: any): Promise<ServiceStatus> {
    const checkedAt = new Date().toISOString();

    if (!service.enabled) {
      return {
        id: service.id,
        key: service.key,
        label: service.name,
        name: service.name,
        description: service.description,
        host: service.host,
        port: service.port,
        commandType: service.commandType as CommandType,
        targetName: service.targetName,
        enabled: service.enabled,
        sortOrder: service.sortOrder,
        status: 'disabled',
        checkedAt,
      };
    }

    this.validateCommandTarget(service.commandType as CommandType, service.targetName);

    try {
      if (service.commandType === 'pm2') {
        const { stdout } = await execFileAsync('pm2', ['describe', service.targetName], {
          timeout: 5000,
        });

        return {
          id: service.id,
          key: service.key,
          label: service.name,
          name: service.name,
          description: service.description,
          host: service.host,
          port: service.port,
          commandType: service.commandType,
          targetName: service.targetName,
          enabled: service.enabled,
          sortOrder: service.sortOrder,
          status: stdout.includes('online') ? 'online' : 'unknown',
          raw: stdout.slice(0, 800),
          checkedAt,
        };
      }

      const { stdout } = await execFileAsync(
        'systemctl',
        ['is-active', service.targetName],
        { timeout: 5000 },
      );

      const raw = stdout.trim();

      return {
        id: service.id,
        key: service.key,
        label: service.name,
        name: service.name,
        description: service.description,
        host: service.host,
        port: service.port,
        commandType: service.commandType,
        targetName: service.targetName,
        enabled: service.enabled,
        sortOrder: service.sortOrder,
        status: raw === 'active' ? 'online' : 'offline',
        raw,
        checkedAt,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';

      return {
        id: service.id,
        key: service.key,
        label: service.name,
        name: service.name,
        description: service.description,
        host: service.host,
        port: service.port,
        commandType: service.commandType as CommandType,
        targetName: service.targetName,
        enabled: service.enabled,
        sortOrder: service.sortOrder,
        status: 'unknown',
        raw: message,
        checkedAt,
      };
    }
  }

  private async executeServiceAction(
    commandType: CommandType,
    targetName: string,
    action: ServiceAction,
  ) {
    if (commandType === 'pm2') {
      await execFileAsync('pm2', [action, targetName], {
        timeout: 15000,
      });
      return;
    }

    const useSudo = process.env.CONTROL_PANEL_SYSTEMCTL_USE_SUDO !== 'false';

    /*
     * If the API restarts itself synchronously, the HTTP response can be cut off
     * and the browser sees "Failed to fetch". For the current API unit, return
     * first and restart shortly after in a detached process.
     */
    if (action === 'restart' && this.isCurrentApiUnit(targetName)) {
      this.scheduleDelayedSystemctlRestart(targetName, useSudo);
      return;
    }

    if (useSudo) {
      await execFileAsync('sudo', ['-n', '/usr/bin/systemctl', action, targetName], {
        timeout: 15000,
      });
      return;
    }

    await execFileAsync('/usr/bin/systemctl', [action, targetName], {
      timeout: 15000,
    });
  }

  private isCurrentApiUnit(targetName: string) {
    const apiUnit = process.env.CONTROL_PANEL_API_SERVICE ?? 'kosmos-cloud-api';
    return targetName === apiUnit || targetName === 'kosmos-cloud-api';
  }

  private scheduleDelayedSystemctlRestart(targetName: string, useSudo: boolean) {
    const command = useSudo
      ? `sleep 1; sudo -n /usr/bin/systemctl restart ${targetName}`
      : `sleep 1; /usr/bin/systemctl restart ${targetName}`;

    const child = spawn('/bin/sh', ['-lc', command], {
      detached: true,
      stdio: 'ignore',
    });

    child.unref();
  }

  private validateCommandTarget(commandType: CommandType, targetName: string) {
    if (!targetName) {
      throw new BadRequestException('실행 대상이 비어 있습니다.');
    }

    const pattern =
      commandType === 'pm2'
        ? /^[a-zA-Z0-9_.@:/-]+$/
        : /^[a-zA-Z0-9_.@:-]+$/;

    if (!pattern.test(targetName)) {
      throw new BadRequestException(
        '실행 대상에는 영문, 숫자, -, _, ., :, @, / 문자만 사용할 수 있습니다.',
      );
    }
  }

  private cleanString(value: unknown) {
    if (value === undefined) return undefined;
    return String(value).trim();
  }

  private cleanNullableString(value: unknown) {
    const cleaned = this.cleanString(value);
    return cleaned ? cleaned : null;
  }

  private slugify(value: string | undefined) {
    const slug = String(value ?? 'service')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return slug || `service-${Date.now()}`;
  }
}
