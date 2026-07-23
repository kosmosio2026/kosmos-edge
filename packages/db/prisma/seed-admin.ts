import { PrismaClient } from '../generated/client';
import { hashPassword } from '../src/security/password';

const prisma = new PrismaClient();

function getRequiredAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;

  if (!password || password.trim().length === 0) {
    throw new Error('ADMIN_PASSWORD is required');
  }

  return password;
}

async function main() {
  const email =
    process.env.ADMIN_EMAIL?.trim() ||
    'admin@kosmos.local';

  const password = getRequiredAdminPassword();

  const name =
    process.env.ADMIN_NAME?.trim() ||
    'System Admin';

  const passwordHash = await hashPassword(password);

  const adminRole = await prisma.role.upsert({
    where: {
      code: 'ADMIN',
    },
    update: {},
    create: {
      code: 'ADMIN',
      name: 'Administrator',
      description: 'System administrator',
    },
  });

  const user = await prisma.user.upsert({
    where: {
      email,
    },
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
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
