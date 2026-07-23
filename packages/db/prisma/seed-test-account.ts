import { PrismaClient } from '../generated/client';
import { hashPassword } from '../src/security/password';

const prisma = new PrismaClient();

function getRequiredTestAccountPassword() {
  const password =
    process.env.KOSMOS_TEST_ACCOUNT_PASSWORD?.trim();

  if (!password) {
    throw new Error(
      'KOSMOS_TEST_ACCOUNT_PASSWORD is required',
    );
  }

  return password;
}

async function main() {
  const email =
    process.env.KOSMOS_TEST_ACCOUNT_EMAIL
      ?.trim() ||
    'admin@kosmos.test';

  const password =
    getRequiredTestAccountPassword();

  const passwordHash = await hashPassword(password);

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

  /*
   * 테스트 계정 seed는 반복 실행될 수 있으므로
   * 동일 테스트 계정의 비밀번호 이력을 누적하지 않는다.
   */
  await prisma.passwordHistory.deleteMany({
    where: {
      userId: user.id,
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