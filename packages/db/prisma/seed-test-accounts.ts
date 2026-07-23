import {
  PrismaClient,
} from '../generated/client';
import {
  hashPassword,
} from '../src/security/password';

const prisma = new PrismaClient();

const INITIAL_PASSWORD =
  process.env.KOSMOS_TEST_ACCOUNT_PASSWORD?.trim() ||
  'kosmos1234!';

const TEST_ACCOUNTS = [
  {
    email: 'admin@kosmos.test',
    name: 'Kosmos Admin',
    roleCode: 'ADMIN',
  },
  {
    email: 'manager@kosmos.test',
    name: 'Kosmos Manager',
    roleCode: 'MANAGER',
  },
  {
    email: 'operator@kosmos.test',
    name: 'Kosmos Operator',
    roleCode: 'OPERATOR',
  },
  {
    email: 'member@kosmos.test',
    name: 'Kosmos Member',
    roleCode: 'MEMBER',
  },
] as const;

async function main() {
  const passwordHash =
    await hashPassword(INITIAL_PASSWORD);

  const tenant = await prisma.tenant.upsert({
    where: {
      code: 'KOSMOS',
    },
    update: {
      name: 'Kosmos',
    },
    create: {
      code: 'KOSMOS',
      name: 'Kosmos',
    },
  });

  for (const account of TEST_ACCOUNTS) {
    const role = await prisma.role.findUniqueOrThrow({
      where: {
        code: account.roleCode,
      },
    });

    const user = await prisma.user.upsert({
      where: {
        email: account.email,
      },
      update: {
        name: account.name,
        passwordHash,
        tenantId: tenant.id,
        status: 'ACTIVE',
        isApproved: true,
        emailVerifiedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
      },
      create: {
        email: account.email,
        name: account.name,
        passwordHash,
        tenantId: tenant.id,
        status: 'ACTIVE',
        isApproved: true,
        emailVerifiedAt: new Date(),
      },
    });

    await prisma.userRole.deleteMany({
      where: {
        userId: user.id,
      },
    });

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
      },
    });

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

    if (account.roleCode === 'MANAGER') {
      await prisma.managerProfile.upsert({
        where: {
          userId: user.id,
        },
        update: {
          companyName: 'Kosmos',
          isApproved: true,
          approvedAt: new Date(),
        },
        create: {
          userId: user.id,
          companyName: 'Kosmos',
          isApproved: true,
          approvedAt: new Date(),
        },
      });
    }

    if (account.roleCode === 'OPERATOR') {
      await prisma.operatorProfile.upsert({
        where: {
          userId: user.id,
        },
        update: {
          companyName: 'Kosmos',
          isApproved: true,
          approvedAt: new Date(),
        },
        create: {
          userId: user.id,
          companyName: 'Kosmos',
          isApproved: true,
          approvedAt: new Date(),
        },
      });
    }

    if (account.roleCode === 'MEMBER') {
      await prisma.memberProfile.upsert({
        where: {
          userId: user.id,
        },
        update: {
          phone: '010-1000-0004',
          vehicleNo: '12가3456',
          membershipNo: 'MEMBER-TEST-001',
        },
        create: {
          userId: user.id,
          phone: '010-1000-0004',
          vehicleNo: '12가3456',
          membershipNo: 'MEMBER-TEST-001',
        },
      });
    }
  }

  console.log('');
  console.log('Minimal test accounts created.');

  console.table(
    TEST_ACCOUNTS.map((account) => ({
      role: account.roleCode,
      email: account.email,
    })),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
