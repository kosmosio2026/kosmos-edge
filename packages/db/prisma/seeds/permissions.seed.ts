import type { PrismaClient } from '../../generated/client';

const PERMISSIONS = [
  ['user.read', 'Read users'],
  ['user.manage', 'Manage users'],
  ['authority-registration.review', 'Review authority registrations'],
  ['rbac.manage', 'Manage RBAC'],

  ['device.read', 'Read devices'],

  ['display.read', 'Read display boards'],
  ['display.manage', 'Manage display board settings'],
  ['display.command', 'Send display board commands'],

  ['parking.lot.read', 'Read parking lots'],
  ['parking.lot.write', 'Write parking lots'],
  ['parking.section.read', 'Read parking sections'],
  ['parking.section.write', 'Write parking sections'],
  ['parking.space.read', 'Read parking spaces'],
  ['parking.space.write', 'Write parking spaces'],


  ['billing.read', 'Read billing'],
  ['billing.manage', 'Manage billing'],
  ['billing.summary.read', 'Read billing summary'],
  ['billing.fee-policy.read', 'Read fee policies'],
  ['billing.fee-policy.manage', 'Manage fee policies'],
  ['billing.discount.read', 'Read discounts'],
  ['billing.discount.manage', 'Manage discounts'],

  ['outstanding.read', 'Read outstanding payments'],
  ['outstanding.manage', 'Manage outstanding payments'],

  ['settlement.read', 'Read settlements'],
  ['settlement.manage', 'Manage settlements'],

  ['operator.dashboard.read', 'Read operator dashboard'],

  ['session.read', 'Read parking sessions'],
  ['session.manage', 'Manage parking sessions'],

  ['control-panel.read', 'Read control panel'],
  ['control-panel.manage', 'Manage control panel'],

  ['enforcement.manage', 'Manage enforcement'],
] as const;

export async function seedPermissions(prisma: PrismaClient) {
  for (const [key, description] of PERMISSIONS) {
    await prisma.permission.upsert({
      where: {
        key,
      },
      update: {
        description,
      },
      create: {
        key,
        description,
      },
    });
  }

  console.log('  ✓ permissions');
}
