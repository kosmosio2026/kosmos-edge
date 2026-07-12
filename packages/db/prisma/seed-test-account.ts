import { PrismaClient } from '../generated/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'daniel.yoon@ksosmos.io.kr';
  const password = 'kosmos2026!!';

  const passwordHash = await hash(password, 12);

  const role = await prisma.role.upsert({
    where: {
      code: 'ADMIN',
    },
    update: {
      name: 'Admin',
    },
    create: {
      code: 'ADMIN',
      name: 'Admin',
      description: 'System administrator',
    },
  });

  const user = await prisma.user.upsert({
    where: {
      email,
    },
    update: {
      name: 'Daniel Yoon',
      passwordHash,
      status: 'ACTIVE',
      isApproved: true,
      emailVerifiedAt: new Date(),
      failedLoginCount: 0,
      lockedUntil: null,
    },
    create: {
      email,
      name: 'Daniel Yoon',
      passwordHash,
      status: 'ACTIVE',
      isApproved: true,
      emailVerifiedAt: new Date(),
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: role.id,
    },
  });

  await prisma.passwordHistory.create({
    data: {
      userId: user.id,
      passwordHash,
    },
  });

  console.log('');
  console.log('Test account created.');
  console.log(`EMAIL=${email}`);
  console.log(`PASSWORD=${password}`);
  console.log(`USER_ID=${user.id}`);
  console.log(`ROLE=${role.code}`);
  console.log('');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });