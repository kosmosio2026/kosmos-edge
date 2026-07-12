import type { PrismaClient } from '../../generated/client';
import { hash } from 'bcryptjs';

const PASSWORD = 'kosmos2026!!';

const TEST_USERS = [
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
  {
    email: 'visitor@kosmos.test',
    name: 'Kosmos Visitor',
    roleCode: 'VISITOR',
  },
];

export async function seedUsers(prisma: PrismaClient) {
  const tenant = await prisma.tenant.upsert({
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

  const passwordHash = await hash(PASSWORD, 12);

  for (const item of TEST_USERS) {
    const role = await prisma.role.findUnique({
      where: {
        code: item.roleCode,
      },
    });

    if (!role) {
      throw new Error(`Role not found: ${item.roleCode}`);
    }

    const user = await prisma.user.upsert({
      where: {
        email: item.email,
      },
      update: {
        name: item.name,
        passwordHash,
        tenantId: tenant.id,
        status: 'ACTIVE',
        isApproved: true,
        emailVerifiedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
      },
      create: {
        email: item.email,
        name: item.name,
        passwordHash,
        tenantId: tenant.id,
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

    const existingPasswordHistory = await prisma.passwordHistory.findFirst({
      where: {
        userId: user.id,
        passwordHash,
      },
    });

    if (!existingPasswordHistory) {
      await prisma.passwordHistory.create({
        data: {
          userId: user.id,
          passwordHash,
        },
      });
    }

    if (item.roleCode === 'MEMBER') {
      await prisma.memberProfile.upsert({
        where: {
          userId: user.id,
        },
        update: {
          phone: '010-0000-0001',
          vehicleNo: '11가1111',
          membershipNo: 'MEMBER-DEV-001',
        },
        create: {
          userId: user.id,
          phone: '010-0000-0001',
          vehicleNo: '11가1111',
          membershipNo: 'MEMBER-DEV-001',
        },
      });
    }

    if (item.roleCode === 'VISITOR') {
      await prisma.visitorProfile.upsert({
        where: {
          userId: user.id,
        },
        update: {
          phone: '010-0000-0002',
          vehicleNo: '22나2222',
          phoneVerified: true,
          visitPurpose: 'Development test visit',
          hostName: 'Kosmos',
        },
        create: {
          userId: user.id,
          phone: '010-0000-0002',
          vehicleNo: '22나2222',
          phoneVerified: true,
          agreedAt: new Date(),
          lastAuthenticatedAt: new Date(),
          visitPurpose: 'Development test visit',
          hostName: 'Kosmos',
        },
      });
    }

    if (item.roleCode === 'MANAGER') {
      await prisma.managerProfile.upsert({
        where: {
          userId: user.id,
        },
        update: {
          companyName: 'Kosmos Parking',
          isApproved: true,
          approvedAt: new Date(),
        },
        create: {
          userId: user.id,
          companyName: 'Kosmos Parking',
          isApproved: true,
          approvedAt: new Date(),
        },
      });
    }

    if (item.roleCode === 'OPERATOR') {
      await prisma.operatorProfile.upsert({
        where: {
          userId: user.id,
        },
        update: {
          companyName: 'Kosmos Parking',
          isApproved: true,
          approvedAt: new Date(),
        },
        create: {
          userId: user.id,
          companyName: 'Kosmos Parking',
          isApproved: true,
          approvedAt: new Date(),
        },
      });
    }
  }

  console.log('  ✓ users');
}
