import { PrismaClient } from '../generated/client';
const prisma = new PrismaClient();

// Helper: safe upsert for numeric PK tables
async function safeUpsert<
  TModel extends {
    findUnique: (args: any) => Promise<any>;
    create: (args: any) => Promise<any>;
  }
>(model: TModel, where: any, create: any) {
  const exists = await model.findUnique({ where });
  if (!exists) {
    await model.create({ data: create });
  }
}

async function main() {
  console.log('Seeding LED Display presets + Display Menu...');

  // === Display Menu ===
  const displayMenu = await prisma.appMenu.upsert({
    where: { code: 'display' },
    update: {
      name: 'Display Boards',
      path: '/display',
      icon: 'Monitor',
      sortOrder: 20,
      isVisible: true,
    },
    create: {
      code: 'display',
      name: 'Display Boards',
      path: '/display',
      icon: 'Monitor',
      sortOrder: 20,
      isVisible: true,
    },
  });

  // === Display Settings Page ===
  await prisma.appPage.upsert({
    where: { code: 'display.settings' },
    update: {
      name: 'Settings',
      route: '/display/settings',
      module: 'display',
      menuId: displayMenu.id,
      sortOrder: 3,
      isVisible: true,
    },
    create: {
      code: 'display.settings',
      name: 'Settings',
      route: '/display/settings',
      module: 'display',
      menuId: displayMenu.id,
      sortOrder: 3,
      isVisible: true,
    },
  });

  // === RBAC: display.write ===
  await prisma.permission.upsert({
    where: { key: 'display.write' },
    update: {
      name: 'Write display board data',
      module: 'display',
      action: 'write',
    },
    create: {
      key: 'display.write',
      name: 'Write display board data',
      module: 'display',
      action: 'write',
    },
  });

  // ADMIN에게 권한 부여
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: 'ADMIN' } });
  const displayWrite = await prisma.permission.findUniqueOrThrow({ where: { key: 'display.write' } });

  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: adminRole.id,
        permissionId: displayWrite.id,
      },
    },
    update: {},
    create: {
      roleId: adminRole.id,
      permissionId: displayWrite.id,
    },
  });

  // === FontPreset ===
  for (const item of [
    { id: 0, code: 0, name: '굴림' },
    { id: 1, code: 1, name: '궁서' },
    { id: 2, code: 2, name: '바탕' },
    { id: 3, code: 3, name: '고딕' },
    { id: 4, code: 4, name: '돋움' },
  ]) {
    await safeUpsert(prisma.fontPreset, { id: item.id }, item);
  }

  // === WidthPreset ===
  for (const item of [
    { id: 1, code: 1, label: '장평 1' },
    { id: 2, code: 2, label: '장평 2' },
    { id: 3, code: 3, label: '장평 3' },
    { id: 4, code: 4, label: '장평 4' },
  ]) {
    await safeUpsert(prisma.widthPreset, { id: item.id }, item);
  }

  // === TextAttribute ===
  for (const item of [
    { id: 0, code: 0, label: '효과없음' },
    { id: 1, code: 1, label: '깜빡임' },
    { id: 2, code: 2, label: '무늬 효과1' },
    { id: 3, code: 3, label: '무늬 효과2' },
    { id: 4, code: 4, label: '무늬 효과3' },
    { id: 5, code: 5, label: '무늬 효과4' },
    { id: 6, code: 6, label: '무늬 효과5' },
    { id: 7, code: 7, label: '무늬 효과6' },
    { id: 8, code: 8, label: '무늬 효과7' },
    { id: 9, code: 9, label: '무늬 효과8' },
    { id: 10, code: 10, label: '무늬 효과9' },
    { id: 11, code: 11, label: '무늬 효과10' },
    { id: 12, code: 12, label: '무늬 효과11' },
    { id: 13, code: 13, label: '위쪽 무지개 화살표' },
    { id: 14, code: 14, label: '아래쪽 무지개 화살표' },
    { id: 15, code: 15, label: '왼쪽 무지개 화살표' },
    { id: 16, code: 16, label: '오른쪽 무지개 화살표' },
    { id: 17, code: 17, label: '반전' },
  ]) {
    await safeUpsert(prisma.textAttribute, { id: item.id }, item);
  }

  // === ColorPreset (0~49) ===
  for (let i = 0; i < 50; i++) {
    await safeUpsert(prisma.colorPreset, { id: i }, {
      id: i,
      code: i,
      label: `색상 ${i}`,
    });
  }

  // === IconPreset ===
  const iconLabels = [
    '느낌표', '당구장1', '당구장2', '전구', '주차장', '부동산', '약국', '와이파이1',
    '와이파이2', '하트', '돈', '폭죽', '우산', '네일', '오른엄지', '왼엄지', '달리기',
    '확성기', '장애인', 'i', '무한화살표', '왼쪽3개화살표', '오른쪽3개화살표',
    '아래3개화살표', '위3개화살표', '오른쪽무지개화살표', '왼쪽무지개화살표',
    '아래무지개화살표', '위무지개화살표', '긴왼쪽화살표', '긴오른쪽화살표',
    '긴위화살표', '긴아래화살표', '짧은왼쪽화살표', '짧은오른쪽화살표',
    '짧은위화살표', '짧은아래화살표', '왼쪽회전화살표', '오른쪽회전화살표',
    '양쪽무지개화살표', '대각선오른쪽아래_나타나기', '대각선오른쪽아래_흐르기',
    '대각선오른쪽위_나타나기', '대각선오른쪽위_흐르기', '대각선왼쪽아래_흐르기',
    '대각선왼쪽위_나타나기', '대각선왼쪽위_흐르기', '대각선왼쪽아래_나타나기',
    '시멘트차', '시멘트차', '정비', '정비',
  ];

  for (let i = 0; i < iconLabels.length; i++) {
    await safeUpsert(prisma.iconPreset, { id: i + 1 }, {
      id: i + 1,
      code: i + 1,
      label: iconLabels[i],
    });
  }

  // === EffectPreset (XX=1~9, YY=0~49) ===
  for (let xx = 1; xx <= 9; xx++) {
    for (let yy = 0; yy <= 49; yy++) {
      await prisma.effectPreset.upsert({
        where: { xx_yy: { xx, yy } },
        update: {},
        create: {
          xx,
          yy,
          label: `효과 ${xx}.${yy}`,
        },
      });
    }
  }

  console.log('LED Display presets seeded.');
}

main().finally(() => prisma.$disconnect());
