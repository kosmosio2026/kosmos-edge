import { PrismaClient } from '../generated/client';
import { seedTenants } from './seeds/tenants.seed';
import { seedRoles } from './seeds/roles.seed';
import { seedPermissions } from './seeds/permissions.seed';
import { seedRolePermissions } from './seeds/role-permissions.seed';
import { seedUsers } from './seeds/users.seed';
import { seedParking } from './seeds/parking.seed';
import { seedScopes } from './seeds/scopes.seed';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  await seedTenants(prisma);
  await seedRoles(prisma);
  await seedPermissions(prisma);
  await seedRolePermissions(prisma);
  await seedUsers(prisma);
  await seedParking(prisma);
  await seedScopes(prisma);

  console.log('✅ Database seed completed.');
}

main()
  .catch((error) => {
    console.error('❌ Database seed failed.');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
