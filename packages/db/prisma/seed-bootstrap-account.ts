import {
  PrismaClient,
} from '../generated/client';
import {
  hashPassword,
} from '../src/security/password';

const prisma = new PrismaClient();

const ALLOWED_ROLES = new Set([
  'ADMIN',
  'MANAGER',
  'OPERATOR',
]);

function required(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function booleanEnv(name: string): boolean {
  return (
    process.env[name]?.trim().toLowerCase() ===
    'true'
  );
}

function printSkip(
  reason: string,
  email: string,
  roleCode: string,
) {
  console.log('');
  console.log('Bootstrap account skipped.');
  console.log(`REASON=${reason}`);
  console.log(`EMAIL=${email}`);
  console.log(`ROLE=${roleCode}`);
}

async function main() {
  const email = required('BOOTSTRAP_EMAIL')
    .toLowerCase();

  const name = required('BOOTSTRAP_NAME');
  const password = required('BOOTSTRAP_PASSWORD');
  const roleCode = required('BOOTSTRAP_ROLE')
    .toUpperCase();

  const forceCreate = booleanEnv(
    'BOOTSTRAP_FORCE_CREATE',
  );

  if (!ALLOWED_ROLES.has(roleCode)) {
    throw new Error(
      `Unsupported BOOTSTRAP_ROLE: ${roleCode}`,
    );
  }

  if (password.length < 10) {
    throw new Error(
      'BOOTSTRAP_PASSWORD must contain at least 10 characters',
    );
  }

  if (password === 'kosmos1234!') {
    throw new Error(
      'Production bootstrap account must not use the demo password',
    );
  }

  /*
   * 기존 이메일 계정은 어떠한 경우에도 수정하지 않는다.
   *
   * 비밀번호, 역할, 승인 상태 및 비밀번호 이력을
   * bootstrap 작업으로 변경해서는 안 된다.
   */
  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    printSkip(
      'EMAIL_ALREADY_EXISTS',
      email,
      roleCode,
    );

    return;
  }

  /*
   * 기본적으로 완전히 비어 있는 신규 DB에서만
   * 최초 bootstrap 계정을 생성한다.
   *
   * 복구 등의 특별한 상황에서만
   * BOOTSTRAP_FORCE_CREATE=true를 명시할 수 있다.
   * 이 경우에도 기존 이메일 계정은 수정하지 않는다.
   */
  const userCount = await prisma.user.count();

  if (userCount > 0 && !forceCreate) {
    printSkip(
      `DATABASE_ALREADY_HAS_USERS:${userCount}`,
      email,
      roleCode,
    );

    return;
  }

  if (forceCreate) {
    console.warn(
      'WARNING: BOOTSTRAP_FORCE_CREATE=true',
    );
  }

  const role = await prisma.role.findUniqueOrThrow({
    where: {
      code: roleCode,
    },
  });

  const passwordHash = await hashPassword(
    password,
  );

  const user = await prisma.$transaction(
    async (transaction) => {
      const tenant =
        await transaction.tenant.upsert({
          where: {
            code: 'KOSMOS',
          },
          update: {},
          create: {
            code: 'KOSMOS',
            name: 'Kosmos',
          },
        });

      const createdUser =
        await transaction.user.create({
          data: {
            email,
            name,
            passwordHash,
            tenantId: tenant.id,
            status: 'ACTIVE',
            isApproved: true,
            emailVerifiedAt: new Date(),
            failedLoginCount: 0,
            lockedUntil: null,
          },
        });

      await transaction.userRole.create({
        data: {
          userId: createdUser.id,
          roleId: role.id,
        },
      });

      await transaction.passwordHistory.create({
        data: {
          userId: createdUser.id,
          passwordHash,
        },
      });

      if (roleCode === 'MANAGER') {
        await transaction.managerProfile.create({
          data: {
            userId: createdUser.id,
            companyName: 'Kosmos',
            isApproved: true,
            approvedAt: new Date(),
          },
        });
      }

      if (roleCode === 'OPERATOR') {
        await transaction.operatorProfile.create({
          data: {
            userId: createdUser.id,
            companyName: 'Kosmos',
            isApproved: true,
            approvedAt: new Date(),
          },
        });
      }

      return createdUser;
    },
  );

  console.log('');
  console.log('Bootstrap account created.');
  console.log('CREATED=true');
  console.log(`USER_ID=${user.id}`);
  console.log(`EMAIL=${email}`);
  console.log(`ROLE=${roleCode}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
