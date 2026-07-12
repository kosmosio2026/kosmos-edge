import type { PrismaClient } from '../../generated/client';

export async function seedTenants(prisma: PrismaClient) {
  await prisma.tenant.upsert({
    where: {
      code: 'KOSMOS',
    },
    update: {
      name: 'Kosmos Parking',
    },
    create: {
      code: 'KOSMOS',
      name: 'Kosmos Parking',
    },
  });

  console.log('  ✓ tenants');
}
