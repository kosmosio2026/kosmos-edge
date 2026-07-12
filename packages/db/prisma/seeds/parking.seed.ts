import type { PrismaClient } from '../../generated/client';

const LOT_CODE = 'LOT-DEV-001';

const SECTIONS = [
  {
    code: 'A',
    name: 'Section A',
    spaces: 10,
  },
  {
    code: 'B',
    name: 'Section B',
    spaces: 10,
  },
];

export async function seedParking(prisma: PrismaClient) {
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

  const lot = await prisma.parkingLot.upsert({
    where: {
      code: LOT_CODE,
    },
    update: {
      name: 'Development Parking Lot',
      tenantId: tenant.id,
      region: '서울특별시',
      district: '강남구',
      address: '서울특별시 강남구 테헤란로 1',
      lat: 37.5665,
      lng: 126.978,
      centerLat: 37.5665,
      centerLng: 126.978,
      representative: 'Kosmos Admin',
      contact: '02-0000-0000',
      isActive: true,
    },
    create: {
      code: LOT_CODE,
      name: 'Development Parking Lot',
      tenantId: tenant.id,
      region: '서울특별시',
      district: '강남구',
      address: '서울특별시 강남구 테헤란로 1',
      lat: 37.5665,
      lng: 126.978,
      centerLat: 37.5665,
      centerLng: 126.978,
      representative: 'Kosmos Admin',
      contact: '02-0000-0000',
      isActive: true,
    },
  });

  for (const sectionSeed of SECTIONS) {
    const section = await prisma.parkingSection.upsert({
      where: {
        parkingLotId_code: {
          parkingLotId: lot.id,
          code: sectionSeed.code,
        },
      },
      update: {
        name: sectionSeed.name,
        isActive: true,
      },
      create: {
        parkingLotId: lot.id,
        code: sectionSeed.code,
        name: sectionSeed.name,
        isActive: true,
      },
    });

    for (let index = 1; index <= sectionSeed.spaces; index += 1) {
      const padded = String(index).padStart(3, '0');
      const code = `${sectionSeed.code}-${padded}`;

      await prisma.parkingSpace.upsert({
        where: {
          sectionId_code: {
            sectionId: section.id,
            code,
          },
        },
        update: {
          number: code,
          status: 'EMPTY',
          isActive: true,
          posX: index,
          posY: sectionSeed.code === 'A' ? 1 : 2,
          widthMeter: 2.5,
          heightMeter: 5,
          rotationDeg: 0,
        },
        create: {
          sectionId: section.id,
          code,
          number: code,
          status: 'EMPTY',
          isActive: true,
          posX: index,
          posY: sectionSeed.code === 'A' ? 1 : 2,
          widthMeter: 2.5,
          heightMeter: 5,
          rotationDeg: 0,
        },
      });
    }
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
    throw new Error('Section A not found after seed.');
  }

  const spaceA001 = await prisma.parkingSpace.findUnique({
    where: {
      sectionId_code: {
        sectionId: sectionA.id,
        code: 'A-001',
      },
    },
  });

  if (!spaceA001) {
    throw new Error('Space A-001 not found after seed.');
  }

  const existingSensorForA001 = await prisma.sensorDevice.findUnique({
    where: {
      parkingSpaceId: spaceA001.id,
    },
  });

  if (!existingSensorForA001) {
    await prisma.sensorDevice.upsert({
      where: {
        serialNumber: 'DEV-SENSOR-001',
      },
      update: {
        name: 'Development Parking Sensor 001',
        type: 'PARKING_SENSOR',
        devEui: 'test-dev-eui',
        parkingLotId: lot.id,
        parkingSectionId: sectionA.id,
        parkingSpaceId: spaceA001.id,
        status: 'ACTIVE',
        lastSeenAt: new Date(),
        metadata: {
          source: 'seed',
          environment: 'development',
        },
      },
      create: {
        name: 'Development Parking Sensor 001',
        type: 'PARKING_SENSOR',
        serialNumber: 'DEV-SENSOR-001',
        devEui: 'test-dev-eui',
        parkingLotId: lot.id,
        parkingSectionId: sectionA.id,
        parkingSpaceId: spaceA001.id,
        status: 'ACTIVE',
        lastSeenAt: new Date(),
        metadata: {
          source: 'seed',
          environment: 'development',
        },
      },
    });
  }

  console.log('  ✓ parking');
}
