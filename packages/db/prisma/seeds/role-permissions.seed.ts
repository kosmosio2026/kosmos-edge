import type { PrismaClient } from '../../generated/client';

const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: [
    'user.read',
    'user.manage',
    'authority-registration.review',
    'rbac.manage',

    'device.read',

    'parking.lot.read',
    'parking.lot.write',
    'parking.section.read',
    'parking.section.write',
    'parking.space.read',
    'parking.space.write',

    'billing.read',
    'billing.manage',
    'billing.summary.read',
    'billing.fee-policy.read',
    'billing.fee-policy.manage',
    'billing.discount.read',
    'billing.discount.manage',

    'outstanding.read',
    'outstanding.manage',

    'settlement.read',
    'settlement.manage',

    'operator.dashboard.read',
    'session.read',
    'session.manage',

    'control-panel.read',
    'control-panel.manage',

    'enforcement.manage',
  ],

  MANAGER: [
    'user.read',
    'user.manage',
    'authority-registration.review',
    'rbac.manage',

    'device.read',

    'parking.lot.read',
    'parking.lot.write',
    'parking.section.read',
    'parking.section.write',
    'parking.space.read',
    'parking.space.write',

    'billing.read',
    'billing.manage',
    'billing.summary.read',
    'billing.fee-policy.read',
    'billing.fee-policy.manage',
    'billing.discount.read',
    'billing.discount.manage',

    'outstanding.read',
    'outstanding.manage',

    'settlement.read',
    'settlement.manage',

    'operator.dashboard.read',
    'session.read',
    'session.manage',

    'control-panel.read',
    'control-panel.manage',

    'enforcement.manage',
  ],

  OPERATOR: [
    'user.read',
    'device.read',
    'parking.lot.read',
    'parking.section.read',
    'parking.space.read',
    'billing.read',
    'outstanding.read',
    'operator.dashboard.read',
    'session.read',
    'session.manage',
    'enforcement.manage',
  ],

  MEMBER: [],

  VISITOR: [],
};

export async function seedRolePermissions(prisma: PrismaClient) {
  for (const [roleCode, permissionKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.findUnique({
      where: {
        code: roleCode,
      },
    });

    if (!role) {
      throw new Error(`Role not found: ${roleCode}`);
    }

    for (const permissionKey of permissionKeys) {
      const permission = await prisma.permission.findUnique({
        where: {
          key: permissionKey,
        },
      });

      if (!permission) {
        throw new Error(`Permission not found: ${permissionKey}`);
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  console.log('  ✓ role permissions');
}
