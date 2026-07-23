import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ApprovalRequestType,
  ApprovalStatus,
  Prisma,
  ScopeType,
  UserStatus,
} from '@parking/db';
import { hash } from 'bcrypt';
import { PaginatedResponse } from '@parking/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserListQueryDto } from './queries/user-list-query.dto';

type StaffRoleCode = 'MANAGER' | 'OPERATOR';

type ScopeRequestSummary = {
  requested: number;
  approved: number;
};

type ManagerParkingLotScopeItem = {
  id: string;
  region: string | null;
  parkingLotName: string | null;
  lotName: string | null;
  name: string | null;
  code: string | null;
  approved: boolean;
  isApproved: boolean;
  status: string;
};

type OperatorSectionScopeItem = {
  id: string;
  region: string | null;
  parkingLotName: string | null;
  lotName: string | null;
  parkingSectionName: string | null;
  sectionName: string | null;
  name: string | null;
  code: string | null;
  approved: boolean;
  isApproved: boolean;
  status: string;
  spaces: number;
  spaceCount: number;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeUser(user: any) {
    return {
      ...user,
      companyName:
        user.companyName ??
        user.managerProfile?.companyName ??
        user.operatorProfile?.companyName ??
        null,
      phone:
        user.phone ??
        user.operatorProfile?.phone ??
        user.managerProfile?.phone ??
        user.memberProfile?.phone ??
        user.visitorProfile?.phone ??
        null,
      approvedAt:
        user.managerProfile?.approvedAt ??
        user.operatorProfile?.approvedAt ??
        null,
      roles: Array.isArray(user.roles)
        ? user.roles.map((r: any) => r.role?.code ?? r.code).filter(Boolean)
        : [],
      scopes: {
        parkingLotIds: Array.isArray(user.scopes)
          ? user.scopes.map((s: any) => s.parkingLotId).filter(Boolean)
          : [],
        parkingSectionIds: Array.isArray(user.scopes)
          ? user.scopes.map((s: any) => s.parkingSectionId).filter(Boolean)
          : [],
        parkingSpaceIds: Array.isArray(user.scopes)
          ? user.scopes.map((s: any) => s.parkingSpaceId).filter(Boolean)
          : [],
      },
    };
  }

  async list(query: UserListQueryDto): Promise<PaginatedResponse<any>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.UserWhereInput = {
      ...(query.status ? { status: query.status as UserStatus } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          roles: {
            include: {
              role: true,
            },
          },
          scopes: true,
          managerProfile: true,
          operatorProfile: true,
          memberProfile: true,
          visitorProfile: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => this.normalizeUser(u)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findStaffByRole(roleCode: StaffRoleCode) {
    const items = await this.prisma.user.findMany({
      where: {
        roles: {
          some: {
            role: {
              code: roleCode,
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        scopes: {
          include: {
            parkingLot: true,
            parkingSection: {
              include: {
                parkingLot: true,
                _count: {
                  select: {
                    spaces: true,
                  },
                },
              },
            },
          },
        },
        managerProfile: true,
        operatorProfile: true,
      },
    });

    if (roleCode === 'MANAGER') {
      const rows = await Promise.all(
        items.map(async (user) => {
          const normalized = this.normalizeUser(user);
          const parkingLotRequests =
            await this.getManagerParkingLotRequests(user.id);
          const approvalSummary =
            this.getApprovalSummary(parkingLotRequests);

          return {
            ...normalized,
            parkingLotRequests,
            parkingLots: parkingLotRequests,
            approvalSummary,
          };
        }),
      );

      return {
        ok: true,
        items: rows,
      };
    }

    const rows = await Promise.all(
      items.map(async (user) => {
        const normalized = this.normalizeUser(user);
        const sectionRequests = await this.getOperatorSectionRequests(user.id);
        const approvalSummary = this.getApprovalSummary(sectionRequests);

        return {
          ...normalized,
          sectionRequests,
          sections: sectionRequests,
          approvalSummary,
        };
      }),
    );

    return {
      ok: true,
      items: rows,
    };
  }

  async listPendingApprovals() {
    const items = await this.prisma.user.findMany({
      where: {
        isApproved: false,
        status: UserStatus.ACTIVE,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        scopes: true,
        managerProfile: true,
        operatorProfile: true,
      },
    });

    return items.map((u) => this.normalizeUser(u));
  }

  async getById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        scopes: true,
        memberProfile: true,
        visitorProfile: true,
        managerProfile: true,
        operatorProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.normalizeUser(user);
  }

  async create(dto: CreateUserDto) {
    const passwordHash = await hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
        isApproved: dto.isApproved ?? false,
        status: UserStatus.ACTIVE,
      },
      select: {
        id: true,
        email: true,
        name: true,
        isApproved: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async findMembers() {
    const items = await this.prisma.memberProfile.findMany({
      include: {
        user: true,
        vehicles: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      ok: true,
      items: items.map((item) => ({
        id: item.userId,
        profileId: item.userId,
        name: item.user?.name ?? null,
        email: item.user?.email ?? null,
        phone: item.phone,
        plateNumber:
          item.vehicleNo ??
          item.vehicles?.[0]?.plateNumber ??
          null,
        isApproved: item.user?.isApproved ?? null,
        memberProfile: {
          phone: item.phone,
          vehicleNo: item.vehicleNo,
        },
        createdAt: item.createdAt,
      })),
    };
  }

  async findVisitors() {
    const items = await this.prisma.visitorProfile.findMany({
      include: {
        user: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      ok: true,
      items: items.map((item) => ({
        id: item.userId,
        profileId: item.userId,
        name: item.user?.name ?? null,
        email: item.user?.email ?? null,
        phone: item.phone,
        plateNumber: item.vehicleNo,
        visitorProfile: {
          phone: item.phone,
          vehicleNo: item.vehicleNo,
        },
        createdAt: item.createdAt,
      })),
    };
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.getById(id);

    const data: Prisma.UserUpdateInput = {
      email: dto.email,
      name: dto.name,
      isApproved: dto.isApproved,
    };

    if (dto.password) {
      data.passwordHash = await hash(dto.password, 10);
    }

    return this.prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        isApproved: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: string) {
    await this.getById(id);

    await this.prisma.user.delete({
      where: { id },
    });

    return { ok: true };
  }

  async approve(
    userId: string,
    input: {
      lotIds: string[];
      sectionIds: string[];
    },
  ) {
    await this.getById(userId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isApproved: true,
        status: UserStatus.ACTIVE,
        scopes: {
          deleteMany: {},
          create: [
            ...input.lotIds.map((lotId) => ({
              scopeType: ScopeType.LOT,
              parkingLotId: lotId,
            })),
            ...input.sectionIds.map((sectionId) => ({
              scopeType: ScopeType.SECTION,
              parkingSectionId: sectionId,
            })),
          ],
        },
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        scopes: true,
      },
    });

    return {
      ok: true,
      message: 'User approved successfully',
      user: this.normalizeUser(user),
    };
  }

  async reject(userId: string) {
    await this.getById(userId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isApproved: false,
        status: UserStatus.SUSPENDED,
        scopes: {
          deleteMany: {},
        },
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        scopes: true,
      },
    });

    return {
      ok: true,
      message: 'User rejected',
      user: this.normalizeUser(user),
    };
  }

  private async getManagerParkingLotRequests(
    userId: string,
  ): Promise<ManagerParkingLotScopeItem[]> {
    const [requests, approvedScopes] = await Promise.all([
      this.prisma.approvalRequest.findMany({
        where: {
          requesterId: userId,
          type: {
            in: [
              ApprovalRequestType.MANAGER_LOT_ACCESS,
              ApprovalRequestType.MANAGER_SCOPE_ACCESS,
              ApprovalRequestType.PARKING_LOT_ACCESS,
              ApprovalRequestType.PARKING_LOT_CREATION,
            ],
          },
        },
        include: {
          ParkingLot: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.userScopeBinding.findMany({
        where: {
          userId,
          scopeType: ScopeType.LOT,
        },
        include: {
          parkingLot: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    const rows = new Map<string, ManagerParkingLotScopeItem>();

    for (const request of requests) {
      const lot =
        request.ParkingLot ??
        (request.requestedParkingLotId
          ? await this.prisma.parkingLot.findUnique({
              where: {
                id: request.requestedParkingLotId,
              },
            })
          : null);

      const id = request.id;
      const approved = request.status === ApprovalStatus.APPROVED;

      rows.set(id, {
        id,
        region: lot?.region ? String(lot.region) : null,
        parkingLotName:
          lot?.name ?? request.requestedParkingLotName ?? null,
        lotName: lot?.name ?? request.requestedParkingLotName ?? null,
        name: lot?.name ?? request.requestedParkingLotName ?? null,
        code: lot?.code ?? null,
        approved,
        isApproved: approved,
        status: request.status,
      });
    }

    for (const scope of approvedScopes) {
      const key = `scope:${scope.id}`;
      const lot = scope.parkingLot;

      rows.set(key, {
        id: scope.id,
        region: lot?.region ? String(lot.region) : null,
        parkingLotName: lot?.name ?? null,
        lotName: lot?.name ?? null,
        name: lot?.name ?? null,
        code: lot?.code ?? null,
        approved: true,
        isApproved: true,
        status: ApprovalStatus.APPROVED,
      });
    }

    return Array.from(rows.values());
  }

  private async getOperatorSectionRequests(
    userId: string,
  ): Promise<OperatorSectionScopeItem[]> {
    const [requests, approvedScopes] = await Promise.all([
      this.prisma.approvalRequest.findMany({
        where: {
          requesterId: userId,
          type: {
            in: [
              ApprovalRequestType.OPERATOR_SECTION_ACCESS,
              ApprovalRequestType.OPERATOR_SCOPE_ACCESS,
            ],
          },
        },
        include: {
          ParkingLot: true,
          ParkingSection: {
            include: {
              parkingLot: true,
              _count: {
                select: {
                  spaces: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.userScopeBinding.findMany({
        where: {
          userId,
          scopeType: ScopeType.SECTION,
        },
        include: {
          parkingLot: true,
          parkingSection: {
            include: {
              parkingLot: true,
              _count: {
                select: {
                  spaces: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    const rows = new Map<string, OperatorSectionScopeItem>();

    for (const request of requests) {
      const section =
        request.ParkingSection ??
        (request.requestedSectionId
          ? await this.prisma.parkingSection.findUnique({
              where: {
                id: request.requestedSectionId,
              },
              include: {
                parkingLot: true,
                _count: {
                  select: {
                    spaces: true,
                  },
                },
              },
            })
          : null);

      const lot = section?.parkingLot ?? request.ParkingLot ?? null;
      const approved = request.status === ApprovalStatus.APPROVED;

      rows.set(request.id, {
        id: request.id,
        region: lot?.region ? String(lot.region) : null,
        parkingLotName:
          lot?.name ?? request.requestedParkingLotName ?? null,
        lotName: lot?.name ?? request.requestedParkingLotName ?? null,
        parkingSectionName: section?.name ?? null,
        sectionName: section?.name ?? null,
        name: section?.name ?? null,
        code: section?.code ?? null,
        approved,
        isApproved: approved,
        status: request.status,
        spaces: section?._count?.spaces ?? 0,
        spaceCount: section?._count?.spaces ?? 0,
      });
    }

    for (const scope of approvedScopes) {
      const section = scope.parkingSection;
      const lot = section?.parkingLot ?? scope.parkingLot ?? null;

      rows.set(`scope:${scope.id}`, {
        id: scope.id,
        region: lot?.region ? String(lot.region) : null,
        parkingLotName: lot?.name ?? null,
        lotName: lot?.name ?? null,
        parkingSectionName: section?.name ?? null,
        sectionName: section?.name ?? null,
        name: section?.name ?? null,
        code: section?.code ?? null,
        approved: true,
        isApproved: true,
        status: ApprovalStatus.APPROVED,
        spaces: section?._count?.spaces ?? 0,
        spaceCount: section?._count?.spaces ?? 0,
      });
    }

    return Array.from(rows.values());
  }

  private getApprovalSummary(
    rows: Array<{ approved: boolean }>,
  ): ScopeRequestSummary {
    return {
      requested: rows.length,
      approved: rows.filter((row) => row.approved).length,
    };
  }
}