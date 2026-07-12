import { PrismaClient } from '../generated/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL ?? 'admin@kosmos.local';
  const password = process.env.ADMIN_PASSWORD ?? 'Admin1234!';
  const name = process.env.ADMIN_NAME ?? 'System Admin';

  const passwordHash = await hash(password, 10);

  const adminRole = await prisma.role.upsert({
    where: { code: 'ADMIN' },
    update: {},
    create: {
      code: 'ADMIN',
      name: 'Administrator',
      description: 'System administrator',
    },
  });

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      isApproved: true,
      status: 'ACTIVE',
    },
    create: {
      email,
      name,
      passwordHash,
      isApproved: true,
      status: 'ACTIVE',
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: adminRole.id,
    },
  });

  console.log('Admin created/updated:', email);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

  // cd /home/project/packages/db
// ADMIN_EMAIL=admin@kosmos.io.kr ADMIN_PASSWORD='kosmos2026!!' npx ts-node prisma/seed-admin.ts