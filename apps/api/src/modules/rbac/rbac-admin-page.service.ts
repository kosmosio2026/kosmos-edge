import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RbacAdminPageService {
  constructor(private readonly prisma: PrismaService) {}

  async getMatrix() {
    const [roles, permissions, menus, pages] = await Promise.all([
      this.prisma.role.findMany({
        include: {
          permissions: { include: { permission: true } },
          menuPolicies: { include: { menu: true } },
          pagePolicies: { include: { page: true } },
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.permission.findMany({
        orderBy: [{ module: 'asc' }, { key: 'asc' }],
      }),
      this.prisma.appMenu.findMany({
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.appPage.findMany({
        include: { menu: true },
        orderBy: [{ module: 'asc' }, { sortOrder: 'asc' }],
      }),
    ]);

    return {
      roles,
      permissions,
      menus,
      pages,
    };
  }
}