import { Injectable, NotFoundException } from '@nestjs/common';
import { ScopeType } from '@parking/db';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { UpdateRoleMenuPoliciesDto } from './dto/update-role-menu-policies.dto';
import { UpdateRolePagePoliciesDto } from './dto/update-role-page-policies.dto';
import { UpdateUserScopesDto } from './dto/update-user-scopes.dto';

@Injectable()
export class RoleAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async listRoles() {
    return this.prisma.role.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            users: true,
            permissions: true,
            menuPolicies: true,
            pagePolicies: true,
          },
        },
      },
    });
  }

  async getRoleById(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        menuPolicies: {
          include: {
            menu: true,
          },
        },
        pagePolicies: {
          include: {
            page: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    return role;
  }

  async createRole(dto: CreateRoleDto) {
    return this.prisma.role.create({
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        isSystem: dto.isSystem ?? false,
      },
    });
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    await this.getRoleById(id);

    return this.prisma.role.update({
      where: { id },
      data: {
        code: dto.code,
        name: dto.name,
        description: dto.description,
        isSystem: dto.isSystem,
      },
    });
  }

  async listMenus() {
    return this.prisma.appMenu.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        children: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
  }

  async listPages() {
    return this.prisma.appPage.findMany({
      orderBy: [{ module: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        menu: true,
      },
    });
  }

  async updateRolePermissions(roleId: string, dto: UpdateRolePermissionsDto) {
    await this.getRoleById(roleId);

    const permissions = await this.prisma.permission.findMany({
      where: {
        key: {
          in: dto.permissionKeys,
        },
      },
      select: {
        id: true,
      },
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({
        where: { roleId },
      });

      if (permissions.length > 0) {
        await tx.rolePermission.createMany({
          data: permissions.map((permission) => ({
            roleId,
            permissionId: permission.id,
          })),
          skipDuplicates: true,
        });
      }

      return tx.role.findUnique({
        where: { id: roleId },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });
    });
  }

  async updateRoleMenuPolicies(roleId: string, dto: UpdateRoleMenuPoliciesDto) {
    await this.getRoleById(roleId);

    const menuCodes = dto.items.map((item) => item.menuCode);

    const menus = await this.prisma.appMenu.findMany({
      where: {
        code: { in: menuCodes },
      },
      select: {
        id: true,
        code: true,
      },
    });

    const menuByCode = new Map(menus.map((menu) => [menu.code, menu.id]));

    return this.prisma.$transaction(async (tx) => {
      await tx.roleMenuPolicy.deleteMany({
        where: { roleId },
      });

      const createData = dto.items
        .map((item) => {
          const menuId = menuByCode.get(item.menuCode);
          if (!menuId) return null;

          return {
            roleId,
            menuId,
            canView: item.canView,
            scopeType: item.scopeType ?? ScopeType.GLOBAL,
          };
        })
        .filter(
          (
            item,
          ): item is {
            roleId: string;
            menuId: string;
            canView: boolean;
            scopeType: ScopeType;
          } => item !== null,
        );

      if (createData.length > 0) {
        await tx.roleMenuPolicy.createMany({
          data: createData,
          skipDuplicates: true,
        });
      }

      return tx.role.findUnique({
        where: { id: roleId },
        include: {
          menuPolicies: {
            include: {
              menu: true,
            },
          },
        },
      });
    });
  }

  async updateRolePagePolicies(roleId: string, dto: UpdateRolePagePoliciesDto) {
    await this.getRoleById(roleId);

    const pageCodes = dto.items.map((item) => item.pageCode);

    const pages = await this.prisma.appPage.findMany({
      where: {
        code: { in: pageCodes },
      },
      select: {
        id: true,
        code: true,
      },
    });

    const pageByCode = new Map(pages.map((page) => [page.code, page.id]));

    return this.prisma.$transaction(async (tx) => {
      await tx.rolePagePolicy.deleteMany({
        where: { roleId },
      });

      const createData = dto.items
        .map((item) => {
          const pageId = pageByCode.get(item.pageCode);
          if (!pageId) return null;

          return {
            roleId,
            pageId,
            canView: item.canView,
            canCreate: item.canCreate ?? false,
            canUpdate: item.canUpdate ?? false,
            canDelete: item.canDelete ?? false,
            canApprove: item.canApprove ?? false,
            canExport: item.canExport ?? false,
            scopeType: item.scopeType ?? ScopeType.GLOBAL,
          };
        })
        .filter(
          (
            item,
          ): item is {
            roleId: string;
            pageId: string;
            canView: boolean;
            canCreate: boolean;
            canUpdate: boolean;
            canDelete: boolean;
            canApprove: boolean;
            canExport: boolean;
            scopeType: ScopeType;
          } => item !== null,
        );

      if (createData.length > 0) {
        await tx.rolePagePolicy.createMany({
          data: createData,
          skipDuplicates: true,
        });
      }

      return tx.role.findUnique({
        where: { id: roleId },
        include: {
          pagePolicies: {
            include: {
              page: true,
            },
          },
        },
      });
    });
  }

  async getUserScopes(userId: string) {
    return this.prisma.userScopeBinding.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: {
        parkingLot: true,
        parkingSection: true,
        parkingSpace: true,
      },
    });
  }

  async updateUserScopes(userId: string, dto: UpdateUserScopesDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.userScopeBinding.deleteMany({
        where: { userId },
      });

      if (dto.items.length > 0) {
        await tx.userScopeBinding.createMany({
          data: dto.items.map((item) => ({
            userId,
            scopeType: item.scopeType,
            parkingLotId: item.parkingLotId,
            parkingSectionId: item.parkingSectionId,
            parkingSpaceId: item.parkingSpaceId,
          })),
          skipDuplicates: true,
        });
      }

      return tx.userScopeBinding.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });
    });
  }
}