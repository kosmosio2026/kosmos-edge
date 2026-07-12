import { PrismaClient, UserStatus } from '@parking/db';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

const TEST_PASSWORD = 'kosmos2026!!';

async function upsertRole(code: string, name: string) {
  return prisma.role.upsert({
    where: { code },
    update: { name },
    create: {
      code,
      name,
      description: `${name} test role`,
      isSystem: true,
    },
  });
}

async function upsertUser(input: {
  email: string;
  name: string;
  phone: string;
  roleCode: string;
  roleName: string;
  tenantId?: string | null;
}) {
  const passwordHash = await hash(TEST_PASSWORD, 10);
  const role = await upsertRole(input.roleCode, input.roleName);

  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {
      name: input.name,
      phone: input.phone,
      passwordHash,
      isApproved: true,
      status: UserStatus.ACTIVE,
      tenantId: input.tenantId ?? undefined,
    },
    create: {
      email: input.email,
      name: input.name,
      phone: input.phone,
      passwordHash,
      isApproved: true,
      status: UserStatus.ACTIVE,
      tenantId: input.tenantId ?? undefined,
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

  return user;
}

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { code: 'KOSMOS-DEMO' },
    update: { name: 'Kosmos Demo Tenant' },
    create: {
      code: 'KOSMOS-DEMO',
      name: 'Kosmos Demo Tenant',
    },
  });

  const admin = await upsertUser({
    email: 'admin@kosmos.test',
    name: 'Kosmos Admin',
    phone: '010-1000-0001',
    roleCode: 'ADMIN',
    roleName: 'Admin',
    tenantId: tenant.id,
  });

  const manager = await upsertUser({
    email: 'manager@kosmos.test',
    name: 'Kosmos Manager',
    phone: '010-1000-0002',
    roleCode: 'MANAGER',
    roleName: 'Manager',
    tenantId: tenant.id,
  });

  const operator = await upsertUser({
    email: 'operator@kosmos.test',
    name: 'Kosmos Operator',
    phone: '010-1000-0003',
    roleCode: 'OPERATOR',
    roleName: 'Operator',
    tenantId: tenant.id,
  });

  const member = await upsertUser({
    email: 'member@kosmos.test',
    name: 'Kosmos Member',
    phone: '010-1000-0004',
    roleCode: 'MEMBER',
    roleName: 'Member',
    tenantId: tenant.id,
  });

  const visitor = await upsertUser({
    email: 'visitor@kosmos.test',
    name: 'Kosmos Visitor',
    phone: '010-1000-0005',
    roleCode: 'VISITOR',
    roleName: 'Visitor',
    tenantId: tenant.id,
  });

  await prisma.managerProfile.upsert({
    where: { userId: manager.id },
    update: {
      companyName: 'Kosmos Demo Manager Co.',
      approvedAt: new Date(),
      approvedById: admin.id,
    },
    create: {
      userId: manager.id,
      companyName: 'Kosmos Demo Manager Co.',
      approvedAt: new Date(),
      approvedById: admin.id,
    },
  });

  await prisma.operatorProfile.upsert({
    where: { userId: operator.id },
    update: {
      companyName: 'Kosmos Demo Operator Co.',
      approvedAt: new Date(),
      approvedById: admin.id,
    },
    create: {
      userId: operator.id,
      companyName: 'Kosmos Demo Operator Co.',
      approvedAt: new Date(),
      approvedById: admin.id,
    },
  });

  await prisma.memberProfile.upsert({
    where: { userId: member.id },
    update: {
      phone: '010-1000-0004',
      vehicleNo: '12가3456',
    },
    create: {
      userId: member.id,
      phone: '010-1000-0004',
      vehicleNo: '12가3456',
    },
  });

  await prisma.visitorProfile.upsert({
    where: { userId: visitor.id },
    update: {
      phone: '010-1000-0005',
      vehicleNo: '34나5678',
    },
    create: {
      userId: visitor.id,
      phone: '010-1000-0005',
      vehicleNo: '34나5678',
    },
  });

  console.log('Seeded test accounts');
  console.table([
    { role: 'ADMIN', email: 'admin@kosmos.test', password: TEST_PASSWORD },
    { role: 'MANAGER', email: 'manager@kosmos.test', password: TEST_PASSWORD },
    { role: 'OPERATOR', email: 'operator@kosmos.test', password: TEST_PASSWORD },
    { role: 'MEMBER', email: 'member@kosmos.test', password: TEST_PASSWORD },
    { role: 'VISITOR', email: 'visitor@kosmos.test', password: TEST_PASSWORD },
  ]);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });