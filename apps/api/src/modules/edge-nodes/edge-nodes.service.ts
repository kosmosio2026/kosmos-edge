import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../common/types/auth-user.type';

type CreateEdgeNodeInput = {
  code?: string;
  name?: string;
  tenantId?: string | null;
  status?: string;
  appVersion?: string | null;
  metadata?: unknown;
};

type UpdateEdgeNodeInput = {
  code?: string;
  name?: string;
  tenantId?: string | null;
  status?: string;
  appVersion?: string | null;
  metadata?: unknown;
};

type IssueKeyInput = {
  keyId?: string;
  expiresAt?: string | null;
  publicKey?: string | null;
};

type AttachParkingLotInput = {
  parkingLotId?: string;
  isPrimary?: boolean;
};

@Injectable()
export class EdgeNodesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser | undefined) {
    this.assertAdmin(user);

    const items = await this.prisma.edgeNode.findMany({
      orderBy: [{ createdAt: 'desc' }],
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        keys: {
          orderBy: [{ createdAt: 'desc' }],
          select: {
            id: true,
            keyId: true,
            isActive: true,
            expiresAt: true,
            revokedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        parkingLots: {
          orderBy: [{ createdAt: 'desc' }],
          include: {
            parkingLot: {
              select: {
                id: true,
                code: true,
                name: true,
                tenantId: true,
              },
            },
          },
        },
      },
    });

    const managersByEdgeNodeId = await this.getManagersByEdgeNodeIds(
      items.map((item) => item.id),
    );

    return {
      ok: true,
      items: items.map((item) =>
        this.serializeEdgeNode(item, managersByEdgeNodeId.get(item.id) ?? []),
      ),
    };
  }

  async get(user: AuthUser | undefined, id: string) {
    this.assertAdmin(user);

    const item = await this.prisma.edgeNode.findUnique({
      where: { id },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        keys: {
          orderBy: [{ createdAt: 'desc' }],
          select: {
            id: true,
            keyId: true,
            isActive: true,
            expiresAt: true,
            revokedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        parkingLots: {
          orderBy: [{ createdAt: 'desc' }],
          include: {
            parkingLot: {
              select: {
                id: true,
                code: true,
                name: true,
                tenantId: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Edge node not found');
    }

    const managersByEdgeNodeId = await this.getManagersByEdgeNodeIds([item.id]);

    return {
      ok: true,
      item: this.serializeEdgeNode(item, managersByEdgeNodeId.get(item.id) ?? []),
    };
  }

  async create(user: AuthUser | undefined, input: CreateEdgeNodeInput) {
    this.assertAdmin(user);

    const code = this.requiredString(input.code, 'code').toUpperCase();
    const name = this.requiredString(input.name, 'name');

    const data: Record<string, unknown> = {
      code,
      name,
      tenantId: this.nullableString(input.tenantId),
      status: this.optionalString(input.status) ?? 'ACTIVE',
      appVersion: this.nullableString(input.appVersion),
    };

    if ('metadata' in input) {
      data.metadata = input.metadata ?? null;
    }

    const item = await this.prisma.edgeNode.create({
      data: data as never,
    });

    await this.writeAuditLog({
      user,
      action: 'EDGE_NODE_CREATED',
      entity: 'EdgeNode',
      entityId: item.id,
      meta: {
        code: item.code,
        name: item.name,
        tenantId: item.tenantId ?? null,
        status: item.status,
      },
    });

    return this.get(user, item.id);
  }

  async update(user: AuthUser | undefined, id: string, input: UpdateEdgeNodeInput) {
    this.assertAdmin(user);

    await this.ensureEdgeNode(id);

    const data: Record<string, unknown> = {};

    if (input.code !== undefined) {
      data.code = this.requiredString(input.code, 'code').toUpperCase();
    }

    if (input.name !== undefined) {
      data.name = this.requiredString(input.name, 'name');
    }

    if (input.tenantId !== undefined) {
      data.tenantId = this.nullableString(input.tenantId);
    }

    if (input.status !== undefined) {
      data.status = this.optionalString(input.status) ?? 'ACTIVE';
    }

    if (input.appVersion !== undefined) {
      data.appVersion = this.nullableString(input.appVersion);
    }

    if ('metadata' in input) {
      data.metadata = input.metadata ?? null;
    }

    await this.prisma.edgeNode.update({
      where: { id },
      data: data as never,
    });

    await this.writeAuditLog({
      user,
      action: 'EDGE_NODE_UPDATED',
      entity: 'EdgeNode',
      entityId: id,
      meta: {
        input,
      },
    });

    return this.get(user, id);
  }


  async issueKey(
    id: string,
    user: AuthUser | undefined,
    input: { revokeExistingActiveKeys?: boolean } = {},
  ) {
    this.assertAdmin(user);

    const edgeNode = await this.prisma.edgeNode.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
      },
    });

    if (!edgeNode || edgeNode.status === 'DELETED') {
      throw new NotFoundException('EdgeNode not found');
    }

    const revokeExistingActiveKeys =
      input.revokeExistingActiveKeys !== false;

    const normalizedCode = edgeNode.code
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const keyId = `edge-${normalizedCode}-${Date.now()}`;
    const apiKey = `kedge_${randomBytes(32).toString('base64url')}`;
    const keyHash = createHash('sha256').update(apiKey).digest('hex');

    const result = await this.prisma.$transaction(async (tx) => {
      let revokedCount = 0;

      if (revokeExistingActiveKeys) {
        const revoked = await tx.edgeNodeKey.updateMany({
          where: {
            edgeNodeId: id,
            isActive: true,
            revokedAt: null,
          },
          data: {
            isActive: false,
            revokedAt: new Date(),
            updatedAt: new Date(),
          },
        });

        revokedCount = revoked.count;
      }

      const key = await tx.edgeNodeKey.create({
        data: {
          edgeNodeId: id,
          keyId,
          keyHash,
          isActive: true,
        },
      });

      return {
        key,
        revokedCount,
      };
    });

    await this.writeAuditLog({
      user,
      action: 'EDGE_NODE_KEY_ISSUED',
      entity: 'EdgeNode',
      entityId: id,
      meta: {
        keyId: result.key.keyId,
        keyRowId: result.key.id,
        revokedCount: result.revokedCount,
        revokeExistingActiveKeys,
      },
    });

    return {
      ok: true,
      apiKey,
      key: result.key,
      revokedCount: result.revokedCount,
      revokeExistingActiveKeys,
      warning:
        'API Key 원문은 지금 한 번만 표시됩니다. Edge 서버 .env.edge에 반영한 뒤 handshake와 worker 상태를 확인하세요.',
    };
  }

  async revokeKey(user: AuthUser | undefined, edgeNodeId: string, keyIdOrId: string) {
    this.assertAdmin(user);

    await this.ensureEdgeNode(edgeNodeId);

    const key = await this.prisma.edgeNodeKey.findFirst({
      where: {
        edgeNodeId,
        OR: [{ id: keyIdOrId }, { keyId: keyIdOrId }],
      },
    });

    if (!key) {
      throw new NotFoundException('Edge node key not found');
    }

    const updated = await this.prisma.edgeNodeKey.update({
      where: { id: key.id },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
      select: {
        id: true,
        keyId: true,
        isActive: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.writeAuditLog({
      user,
      action: 'EDGE_NODE_KEY_REVOKED',
      entity: 'EdgeNodeKey',
      entityId: updated.id,
      meta: {
        edgeNodeId,
        keyId: updated.keyId,
      },
    });

    return {
      ok: true,
      key: updated,
    };
  }

  async attachParkingLot(
    user: AuthUser | undefined,
    edgeNodeId: string,
    input: AttachParkingLotInput,
  ) {
    this.assertAdmin(user);

    const parkingLotId = this.requiredString(input.parkingLotId, 'parkingLotId');

    await this.ensureEdgeNode(edgeNodeId);

    const parkingLot = await this.prisma.parkingLot.findUnique({
      where: { id: parkingLotId },
      select: {
        id: true,
        code: true,
        name: true,
        tenantId: true,
      },
    });

    if (!parkingLot) {
      throw new NotFoundException('Parking lot not found');
    }

    if (input.isPrimary) {
      await this.prisma.edgeParkingLot.updateMany({
        where: { edgeNodeId },
        data: { isPrimary: false },
      });
    }

    const link = await this.prisma.edgeParkingLot.upsert({
      where: {
        edgeNodeId_parkingLotId: {
          edgeNodeId,
          parkingLotId,
        },
      },
      create: {
        edgeNodeId,
        parkingLotId,
        isPrimary: Boolean(input.isPrimary),
      },
      update: {
        isPrimary: Boolean(input.isPrimary),
      },
      include: {
        parkingLot: {
          select: {
            id: true,
            code: true,
            name: true,
            tenantId: true,
          },
        },
      },
    });

    await this.writeAuditLog({
      user,
      action: 'EDGE_PARKING_LOT_LINKED',
      entity: 'EdgeNode',
      entityId: edgeNodeId,
      meta: {
        parkingLotId,
        edgeParkingLotId: link.id,
        isPrimary: Boolean(input.isPrimary),
        parkingLotCode: link.parkingLot?.code ?? null,
        parkingLotName: link.parkingLot?.name ?? null,
      },
    });

    return {
      ok: true,
      link,
    };
  }


  async listAuditLogs(user: AuthUser | undefined, id: string) {
    this.assertAdmin(user);
    await this.ensureEdgeNode(id);

    const logs = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          {
            entity: 'EdgeNode',
            entityId: id,
          },
          {
            action: 'EDGE_NODE_KEY_REVOKED',
          },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 300,
    });

    const items = logs
      .filter((log: any) => {
        if (log.entity === 'EdgeNode' && log.entityId === id) {
          return true;
        }

        const meta = log.meta;

        return (
          meta &&
          typeof meta === 'object' &&
          !Array.isArray(meta) &&
          meta.edgeNodeId === id
        );
      })
      .slice(0, 100);

    return {
      ok: true,
      items,
    };
  }

  async listTenantOptions(user: AuthUser | undefined) {
    this.assertAdmin(user);

    const items = await this.prisma.tenant.findMany({
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      ok: true,
      items,
    };
  }

  async listParkingLotOptions(user: AuthUser | undefined) {
    this.assertAdmin(user);

    const items = await this.prisma.parkingLot.findMany({
      orderBy: [{ name: 'asc' }],
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
        edgeParkingLots: {
          include: {
            edgeNode: {
              select: {
                id: true,
                code: true,
                name: true,
                status: true,
              },
            },
          },
        },
      },
    });

    return {
      ok: true,
      items: items.map((item: any) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        tenantId: item.tenantId,
        tenantName: item.tenant?.name ?? null,
        isActive: item.isActive,
        address: item.address ?? null,
        region: item.region ?? null,
        district: item.district ?? null,
        edgeLinks: (item.edgeParkingLots ?? []).map((link: any) => ({
          id: link.id,
          edgeNodeId: link.edgeNodeId,
          isPrimary: link.isPrimary,
          edgeNode: link.edgeNode,
        })),
      })),
    };
  }

  async detachParkingLot(
    user: AuthUser | undefined,
    edgeNodeId: string,
    parkingLotId: string,
  ) {
    this.assertAdmin(user);

    await this.ensureEdgeNode(edgeNodeId);

    const result = await this.prisma.edgeParkingLot.deleteMany({
      where: {
        edgeNodeId,
        parkingLotId,
      },
    });

    await this.writeAuditLog({
      user,
      action: 'EDGE_PARKING_LOT_UNLINKED',
      entity: 'EdgeNode',
      entityId: edgeNodeId,
      meta: {
        parkingLotId,
        deletedCount: result.count,
      },
    });

    return {
      ok: true,
      deletedCount: result.count,
    };
  }

  async softDelete(user: AuthUser | undefined, id: string) {
    this.assertAdmin(user);

    await this.ensureEdgeNode(id);

    await this.prisma.$transaction([
      this.prisma.edgeNodeKey.updateMany({
        where: {
          edgeNodeId: id,
          isActive: true,
        },
        data: {
          isActive: false,
          revokedAt: new Date(),
        },
      }),
      this.prisma.edgeNode.update({
        where: { id },
        data: {
          status: 'DELETED',
        },
      }),
    ]);

    await this.writeAuditLog({
      user,
      action: 'EDGE_NODE_DELETED',
      entity: 'EdgeNode',
      entityId: id,
      meta: {
        softDelete: true,
        status: 'DELETED',
      },
    });

    return this.get(user, id);
  }

  async runtimeStatus(user: AuthUser | undefined, id: string) {
    const nodeData = await this.get(user, id);
    const item = (nodeData as any).item ?? nodeData;
    const prismaAny = this.prisma as any;

    const destination = `EDGE:${id}`;

    const [
      cloudActiveKeyCount,
      cloudRevokedKeyCount,
      cloudPendingOutboxCount,
      cloudFailedOutboxCount,
      recentCloudOutboxIssues,
    ] = await Promise.all([
      prismaAny.edgeNodeKey.count({
        where: {
          edgeNodeId: id,
          isActive: true,
          revokedAt: null,
        },
      }),
      prismaAny.edgeNodeKey.count({
        where: {
          edgeNodeId: id,
          OR: [
            { isActive: false },
            { revokedAt: { not: null } },
          ],
        },
      }),
      prismaAny.syncOutbox.count({
        where: {
          destination,
          status: 'PENDING',
        },
      }),
      prismaAny.syncOutbox.count({
        where: {
          destination,
          status: 'FAILED',
        },
      }),
      prismaAny.syncOutbox.findMany({
        where: {
          destination,
          status: {
            in: ['PENDING', 'FAILED'],
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 5,
        select: {
          id: true,
          eventId: true,
          eventType: true,
          destination: true,
          status: true,
          retryCount: true,
          lastError: true,
          nextRetryAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const lastSeenAt = item.lastSeenAt ? new Date(item.lastSeenAt) : null;
    const now = new Date();

    const secondsSinceLastSeen = lastSeenAt
      ? Math.max(0, Math.round((now.getTime() - lastSeenAt.getTime()) / 1000))
      : null;

    const connectionStatus =
      secondsSinceLastSeen === null
        ? 'UNKNOWN'
        : secondsSinceLastSeen <= 300
          ? 'ONLINE'
          : secondsSinceLastSeen <= 1800
            ? 'STALE'
            : 'OFFLINE';

    return {
      ok: true,
      item: {
        edgeNode: {
          id: item.id,
          code: item.code,
          name: item.name,
          status: item.status,
          appVersion: item.appVersion,
          lastSeenAt: item.lastSeenAt,
          lastConnectedAt: item.lastConnectedAt,
          lastSyncAt: item.lastSyncAt,
        },
        connection: {
          status: connectionStatus,
          secondsSinceLastSeen,
          checkedAt: now.toISOString(),
        },
        cloudKeys: {
          activeCount: cloudActiveKeyCount,
          revokedCount: cloudRevokedKeyCount,
          totalCount: cloudActiveKeyCount + cloudRevokedKeyCount,
        },
        cloudOutbox: {
          destination,
          pendingCount: cloudPendingOutboxCount,
          failedCount: cloudFailedOutboxCount,
          recentIssues: recentCloudOutboxIssues,
        },
        notes: [
          '이 상태 카드는 Cloud DB 기준입니다.',
          'Edge API worker live status는 Edge API Key가 필요한 보호 endpoint이므로 2차 live check 기능에서 별도로 다룹니다.',
        ],
      },
    };
  }

  private async ensureEdgeNode(id: string) {
    const edgeNode = await this.prisma.edgeNode.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    if (!edgeNode) {
      throw new NotFoundException('Edge node not found');
    }

    return edgeNode;
  }

  private serializeEdgeNode(item: any, managers: any[] = []) {
    return {
      id: item.id,
      code: item.code,
      name: item.name,
      tenantId: item.tenantId,
      tenantName: item.tenant?.name ?? null,
      status: item.status,
      appVersion: item.appVersion,
      lastSeenAt: item.lastSeenAt,
      lastConnectedAt: item.lastConnectedAt,
      lastSyncAt: item.lastSyncAt,
      metadata: item.metadata,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      keys: item.keys ?? [],
      managers,
      parkingLots: (item.parkingLots ?? []).map((link: any) => ({
        id: link.id,
        edgeNodeId: link.edgeNodeId,
        parkingLotId: link.parkingLotId,
        isPrimary: link.isPrimary,
        createdAt: link.createdAt,
        parkingLot: link.parkingLot,
      })),
    };
  }

  private async getManagersByEdgeNodeIds(edgeNodeIds: string[]) {
    const uniqueEdgeNodeIds = Array.from(new Set(edgeNodeIds.filter(Boolean)));

    if (uniqueEdgeNodeIds.length === 0) {
      return new Map<string, any[]>();
    }

    const edgeParkingLots = await this.prisma.edgeParkingLot.findMany({
      where: {
        edgeNodeId: {
          in: uniqueEdgeNodeIds,
        },
      },
      select: {
        edgeNodeId: true,
        parkingLotId: true,
      },
    });

    const parkingLotIds = Array.from(
      new Set(edgeParkingLots.map((item) => item.parkingLotId).filter(Boolean)),
    );

    if (parkingLotIds.length === 0) {
      return new Map(uniqueEdgeNodeIds.map((id) => [id, []]));
    }

    const managerRows = await this.prisma.managerParkingLot.findMany({
      where: {
        parkingLotId: {
          in: parkingLotIds,
        },
      },
      include: {
        managerProfile: {
          include: {
            user: true,
          },
        },
      },
    });

    const managersByParkingLotId = new Map<string, any[]>();

    for (const row of managerRows as any[]) {
      const user = row.managerProfile?.user ?? {};
      const manager = {
        id: row.managerProfileUserId ?? user.id,
        userId: row.managerProfileUserId ?? user.id,
        name:
          user.name ??
          user.displayName ??
          row.managerProfile?.companyName ??
          user.email ??
          row.managerProfileUserId,
        email: user.email ?? null,
        companyName: row.managerProfile?.companyName ?? null,
        department: row.managerProfile?.department ?? null,
        isApproved: row.managerProfile?.isApproved ?? null,
        parkingLotIds: [row.parkingLotId],
      };

      const list = managersByParkingLotId.get(row.parkingLotId) ?? [];
      list.push(manager);
      managersByParkingLotId.set(row.parkingLotId, list);
    }

    const result = new Map<string, any[]>();

    for (const edgeNodeId of uniqueEdgeNodeIds) {
      const links = edgeParkingLots.filter((link) => link.edgeNodeId === edgeNodeId);
      const managersById = new Map<string, any>();

      for (const link of links) {
        const managers = managersByParkingLotId.get(link.parkingLotId) ?? [];

        for (const manager of managers) {
          const existing = managersById.get(manager.userId);

          if (existing) {
            existing.parkingLotIds = Array.from(
              new Set([...(existing.parkingLotIds ?? []), link.parkingLotId]),
            );
          } else {
            managersById.set(manager.userId, {
              ...manager,
              parkingLotIds: [link.parkingLotId],
            });
          }
        }
      }

      result.set(edgeNodeId, Array.from(managersById.values()));
    }

    return result;
  }


  private async writeAuditLog(input: {
    user: AuthUser | undefined;
    action: string;
    entity?: string;
    entityId?: string;
    meta?: Record<string, unknown>;
  }) {
    const userId = this.resolveAuditUserId(input.user);

    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action: input.action,
          entity: input.entity ?? null,
          entityId: input.entityId ?? null,
          meta: (input.meta ?? {}) as any,
        },
      });
    } catch {
      // Audit logging must not block the primary EdgeNode operation.
    }
  }

  private resolveAuditUserId(user: AuthUser | undefined) {
    const candidate =
      (user as any)?.id ??
      (user as any)?.userId ??
      (user as any)?.sub ??
      null;

    return typeof candidate === 'string' && candidate.trim()
      ? candidate
      : null;
  }

  private assertAdmin(user: AuthUser | undefined) {
    if (!user?.roles?.includes('ADMIN')) {
      throw new ForbiddenException('Admin role required');
    }
  }

  private requiredString(value: unknown, field: string) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }

    return value.trim();
  }

  private optionalString(value: unknown) {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  private nullableString(value: unknown) {
    if (value === null) return null;
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
  }

  private hashApiKey(apiKey: string) {
    return createHash('sha256').update(apiKey).digest('hex');
  }
}
