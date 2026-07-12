import type { PrismaClient } from '../../generated/client';

export async function seedScopes(prisma: PrismaClient) {
  const manager = await prisma.user.findUnique({
    where: {
      email: 'manager@kosmos.test',
    },
  });

  const operator = await prisma.user.findUnique({
    where: {
      email: 'operator@kosmos.test',
    },
  });

  const lot = await prisma.parkingLot.findUnique({
    where: {
      code: 'LOT-DEV-001',
    },
  });

  if (!manager || !operator || !lot) {
    console.log('  - scopes skipped: manager/operator/lot missing');
    return;
  }

  const sectionA = await prisma.parkingSection.findUnique({
    where: {
      parkingLotId_code: {
        parkingLotId: lot.id,
        code: 'A',
      },
    },
  });

  if (!sectionA) {
    console.log('  - scopes skipped: Section A missing');
    return;
  }

  await prisma.managerParkingLot.upsert({
    where: {
      managerProfileUserId_parkingLotId: {
        managerProfileUserId: manager.id,
        parkingLotId: lot.id,
      },
    },
    update: {},
    create: {
      managerProfileUserId: manager.id,
      parkingLotId: lot.id,
    },
  });

  await prisma.operatorParkingSection.upsert({
    where: {
      operatorProfileUserId_sectionId: {
        operatorProfileUserId: operator.id,
        sectionId: sectionA.id,
      },
    },
    update: {
      parkingLotId: lot.id,
    },
    create: {
      operatorProfileUserId: operator.id,
      parkingLotId: lot.id,
      sectionId: sectionA.id,
    },
  });

  const managerLotScope = await prisma.userScopeBinding.findFirst({
    where: {
      userId: manager.id,
      scopeType: 'LOT',
      parkingLotId: lot.id,
    },
  });

  if (!managerLotScope) {
    await prisma.userScopeBinding.create({
      data: {
        userId: manager.id,
        scopeType: 'LOT',
        parkingLotId: lot.id,
      },
    });
  }

  const operatorSectionScope = await prisma.userScopeBinding.findFirst({
    where: {
      userId: operator.id,
      scopeType: 'SECTION',
      parkingSectionId: sectionA.id,
    },
  });

  if (!operatorSectionScope) {
    await prisma.userScopeBinding.create({
      data: {
        userId: operator.id,
        scopeType: 'SECTION',
        parkingLotId: lot.id,
        parkingSectionId: sectionA.id,
      },
    });
  }

  console.log('  ✓ scopes');
}
