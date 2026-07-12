import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PageActionType } from '../../common/decorators/require-page-access.decorator';

type AccessProfile = {
  user: {
    id: string;
    email: string | null;
    name: string;
  };
  roles: Array<{
    id: string;
    code: string;
    name: string;
  }>;
  permissions: string[];
  menuPolicies: Array<{
    id: string;
    canView: boolean;
    scopeType: string;
    menu: {
      id: string;
      code: string;
      name: string;
      path: string | null;
      icon: string | null;
      sortOrder: number;
      isVisible: boolean;
    };
  }>;
  pagePolicies: Array<{
    id: string;
    canView: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canApprove: boolean;
    canExport: boolean;
    scopeType: string;
    page: {
      id: string;
      code: string;
      name: string;
      route: string;
      module: string;
      description: string | null;
      sortOrder: number;
      isVisible: boolean;
    };
  }>;
  scopes: Array<{
    id: string;
    scopeType: string;
    parkingLotId: string | null;
    parkingSectionId: string | null;
    parkingSpaceId: string | null;
  }>;
};

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccessProfile(userId: string): Promise<AccessProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
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
            },
          },
        },
        scopes: true,
      },
    });

    if (!user) {
      return null;
    }

    const permissions = Array.from(
      new Set(
        user.roles.flatMap((userRole) =>
          userRole.role.permissions.map(
            (rolePermission) => rolePermission.permission.key,
          ),
        ),
      ),
    );

    const menuPolicyMap = new Map<
      string,
      {
        id: string;
        canView: boolean;
        scopeType: string;
        menu: {
          id: string;
          code: string;
          name: string;
          path: string | null;
          icon: string | null;
          sortOrder: number;
          isVisible: boolean;
        };
      }
    >();

    for (const userRole of user.roles) {
      for (const policy of userRole.role.menuPolicies) {
        const key = `${policy.roleId}:${policy.menuId}`;

        if (!menuPolicyMap.has(key)) {
          menuPolicyMap.set(key, {
            id: policy.id,
            canView: policy.canView,
            scopeType: policy.scopeType,
            menu: {
              id: policy.menu.id,
              code: policy.menu.code,
              name: policy.menu.name,
              path: policy.menu.path,
              icon: policy.menu.icon,
              sortOrder: policy.menu.sortOrder,
              isVisible: policy.menu.isVisible,
            },
          });
        }
      }
    }

    const pagePolicyMap = new Map<
      string,
      {
        id: string;
        canView: boolean;
        canCreate: boolean;
        canUpdate: boolean;
        canDelete: boolean;
        canApprove: boolean;
        canExport: boolean;
        scopeType: string;
        page: {
          id: string;
          code: string;
          name: string;
          route: string;
          module: string;
          description: string | null;
          sortOrder: number;
          isVisible: boolean;
        };
      }
    >();

    for (const userRole of user.roles) {
      for (const policy of userRole.role.pagePolicies) {
        const key = `${policy.roleId}:${policy.pageId}`;

        if (!pagePolicyMap.has(key)) {
          pagePolicyMap.set(key, {
            id: policy.id,
            canView: policy.canView,
            canCreate: policy.canCreate,
            canUpdate: policy.canUpdate,
            canDelete: policy.canDelete,
            canApprove: policy.canApprove,
            canExport: policy.canExport,
            scopeType: policy.scopeType,
            page: {
              id: policy.page.id,
              code: policy.page.code,
              name: policy.page.name,
              route: policy.page.route,
              module: policy.page.module,
              description: policy.page.description,
              sortOrder: policy.page.sortOrder,
              isVisible: policy.page.isVisible,
            },
          });
        }
      }
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      roles: user.roles.map((userRole) => ({
        id: userRole.role.id,
        code: userRole.role.code,
        name: userRole.role.name,
      })),
      permissions,
      menuPolicies: Array.from(menuPolicyMap.values()),
      pagePolicies: Array.from(pagePolicyMap.values()),
      scopes: user.scopes.map((scope) => ({
        id: scope.id,
        scopeType: scope.scopeType,
        parkingLotId: scope.parkingLotId,
        parkingSectionId: scope.parkingSectionId,
        parkingSpaceId: scope.parkingSpaceId,
      })),
    };
  }

  async getUserPermissionKeys(userId: string): Promise<Set<string>> {
    const profile = await this.getAccessProfile(userId);

    if (!profile) {
      return new Set();
    }

    return new Set(profile.permissions);
  }

  async hasPermissions(
    userId: string,
    requiredPermissions: string[],
  ): Promise<boolean> {
    return this.userHasPermissions(userId, requiredPermissions);
  }

  async userHasPermissions(
    userId: string,
    requiredPermissions: string[],
  ): Promise<boolean> {
    if (!requiredPermissions.length) {
      return true;
    }

    const permissions = await this.getUserPermissionKeys(userId);

    return requiredPermissions.every((permission) =>
      permissions.has(permission),
    );
  }

  async hasPageAccess(
    userId: string,
    pageCode: string,
    action: PageActionType,
  ): Promise<boolean> {
    const profile = await this.getAccessProfile(userId);

    if (!profile) {
      return false;
    }

    const matched = profile.pagePolicies.filter(
      (policy) => policy.page.code === pageCode,
    );

    if (!matched.length) {
      return false;
    }

    return matched.some((policy) => {
      switch (action) {
        case 'view':
          return policy.canView;
        case 'create':
          return policy.canCreate;
        case 'update':
          return policy.canUpdate;
        case 'delete':
          return policy.canDelete;
        case 'approve':
          return policy.canApprove;
        case 'export':
          return policy.canExport;
        default:
          return false;
      }
    });
  }
}