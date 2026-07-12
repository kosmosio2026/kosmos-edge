import type { PrismaClient } from '../../generated/client';

const ROLES = [
  { code: 'ADMIN', name: 'Admin' },
  { code: 'MANAGER', name: 'Manager' },
  { code: 'OPERATOR', name: 'Operator' },
  { code: 'MEMBER', name: 'Member' },
  { code: 'VISITOR', name: 'Visitor' },
];

export async function seedRoles(prisma: PrismaClient) {
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: {
        code: role.code,
      },
      update: {
        name: role.name,
      },
      create: role,
    });
  }

  console.log('  ✓ roles');
}
