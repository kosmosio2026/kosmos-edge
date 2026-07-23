import { PrismaClient } from '../generated/client';

const prisma = new PrismaClient();

async function main() {
  const managementCompany = await prisma.managementCompany.upsert({
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
      code: 'LOT-DEV-001',
    },
    update: {
      name: 'Development Parking Lot',
      managementCompanyId: managementCompany.id,
      isActive: true,
    },
    create: {
      code: 'LOT-DEV-001',
      name: 'Development Parking Lot',
      managementCompanyId: managementCompany.id,
      isActive: true,
    },
  });

  const section = await prisma.parkingSection.upsert({
    where: {
      parkingLotId_code: {
        parkingLotId: lot.id,
        code: 'A',
      },
    },
    update: {
      name: 'Section A',
      isActive: true,
    },
    create: {
      parkingLotId: lot.id,
      code: 'A',
      name: 'Section A',
      isActive: true,
    },
  });

  const space = await prisma.parkingSpace.upsert({
    where: {
      sectionId_code: {
        sectionId: section.id,
        code: 'A-001',
      },
    },
    update: {
      status: 'EMPTY',
      isActive: true,
    },
    create: {
      sectionId: section.id,
      code: 'A-001',
      number: 'A-001',
      status: 'EMPTY',
      isActive: true,
    },
  });

  const sensor = await prisma.sensorDevice.upsert({
    where: {
      serialNumber: 'DEV-SENSOR-001',
    },
    update: {
      name: 'Development Parking Sensor 001',
      devEui: 'test-dev-eui',
      parkingLotId: lot.id,
      parkingSectionId: section.id,
      parkingSpaceId: space.id,
      status: 'ACTIVE',
    },
    create: {
      name: 'Development Parking Sensor 001',
      type: 'PARKING_SENSOR',
      serialNumber: 'DEV-SENSOR-001',
      devEui: 'test-dev-eui',
      parkingLotId: lot.id,
      parkingSectionId: section.id,
      parkingSpaceId: space.id,
      status: 'ACTIVE',
    },
  });

  console.log('');
  console.log('Sensor dev seed completed.');
  console.log(`PARKING_LOT_ID=${lot.id}`);
  console.log(`PARKING_SECTION_ID=${section.id}`);
  console.log(`PARKING_SPACE_ID=${space.id}`);
  console.log(`SENSOR_DEVICE_ID=${sensor.id}`);
  console.log('DEV_EUI=test-dev-eui');
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