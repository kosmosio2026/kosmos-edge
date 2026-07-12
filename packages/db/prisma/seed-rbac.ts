import { PrismaClient } from '../generated/client';

const prisma = new PrismaClient();

const roles = [
  {
    code: 'ADMIN',
    name: 'Admin',
    description: 'Legacy system administrator with full access',
    isSystem: true,
  },
  {
    code: 'MANAGER',
    name: 'Manager',
    description: 'Legacy parking lot manager',
    isSystem: true,
  },
  {
    code: 'OPERATOR',
    name: 'Operator',
    description: 'Legacy parking field operator',
    isSystem: true,
  },
  {
    code: 'MEMBER',
    name: 'Member',
    description: 'Parking service member',
    isSystem: true,
  },
  {
    code: 'VISITOR',
    name: 'Visitor',
    description: 'Visitor parking user',
    isSystem: true,
  },

  {
    code: 'SYSTEM_SUPERUSER',
    name: 'System Superuser',
    description: 'Full system access',
    isSystem: true,
  },
  {
    code: 'CLOUD_ADMIN',
    name: 'Cloud Admin',
    description: 'Cloud platform administrator',
    isSystem: true,
  },
  {
    code: 'TENANT_ADMIN',
    name: 'Tenant Admin',
    description: 'Tenant administrator',
    isSystem: true,
  },
  {
    code: 'PARKING_MANAGER',
    name: 'Parking Manager',
    description: 'Parking lot manager',
    isSystem: true,
  },
  {
    code: 'PARKING_OPERATOR',
    name: 'Parking Operator',
    description: 'On-site parking operator',
    isSystem: true,
  },
  {
    code: 'EDGE_SERVICE',
    name: 'Edge Service',
    description: 'Edge service identity',
    isSystem: true,
  },
  {
    code: 'SYNC_CLIENT',
    name: 'Sync Client',
    description: 'Cloud-edge sync identity',
    isSystem: true,
  },
];

const permissions = [
  ['auth.login', 'Auth Login', 'auth', 'login'],
  ['auth.logout', 'Auth Logout', 'auth', 'logout'],
  ['auth.refresh', 'Auth Refresh', 'auth', 'refresh'],

  ['analytics.read', 'Analytics Read', 'analytics', 'read'],
  ['statistics.read', 'Statistics Read', 'statistics', 'read'],

  ['user.read', 'User Read', 'user', 'read'],
  ['user.create', 'User Create', 'user', 'create'],
  ['user.update', 'User Update', 'user', 'update'],
  ['user.approve', 'User Approve', 'user', 'approve'],
  ['user.suspend', 'User Suspend', 'user', 'suspend'],
  ['user.manage', 'User Manage', 'user', 'manage'],

  ['tenant.read', 'Tenant Read', 'tenant', 'read'],
  ['tenant.create', 'Tenant Create', 'tenant', 'create'],
  ['tenant.update', 'Tenant Update', 'tenant', 'update'],

  ['session.manage', 'Session Manage', 'session', 'manage'],

  ['parking.lot.read', 'Parking Lot Read', 'parking', 'lot.read'],
  ['parking.lot.create', 'Parking Lot Create', 'parking', 'lot.create'],
  ['parking.lot.update', 'Parking Lot Update', 'parking', 'lot.update'],
  ['parking.lot.create_request', 'Parking Lot Create Request', 'parking', 'lot.create_request'],
  ['parking.lot.update_request', 'Parking Lot Update Request', 'parking', 'lot.update_request'],

  ['parking.section.read', 'Parking Section Read', 'parking', 'section.read'],
  ['parking.section.write', 'Parking Section Write', 'parking', 'section.write'],
  ['parking.zone.read', 'Parking Zone Read', 'parking', 'zone.read'],
  ['parking.zone.create', 'Parking Zone Create', 'parking', 'zone.create'],
  ['parking.zone.update', 'Parking Zone Update', 'parking', 'zone.update'],
  ['parking.zone.create_request', 'Parking Zone Create Request', 'parking', 'zone.create_request'],
  ['parking.zone.update_request', 'Parking Zone Update Request', 'parking', 'zone.update_request'],

  ['parking.space.read', 'Parking Space Read', 'parking', 'space.read'],
  ['parking.space.write', 'Parking Space Write', 'parking', 'space.write'],
  ['parking.space.create', 'Parking Space Create', 'parking', 'space.create'],
  ['parking.space.update', 'Parking Space Update', 'parking', 'space.update'],
  ['parking.space.register', 'Parking Space Register', 'parking', 'space.register'],
  ['parking.space.override', 'Parking Space Override', 'parking', 'space.override'],
  ['parking.space.map_edit', 'Parking Space Map Edit', 'parking', 'space.map_edit'],

  ['parking.session.read', 'Parking Session Read', 'parking', 'session.read'],
  ['parking.registration.create', 'Parking Registration Create', 'parking', 'registration.create'],
  ['parking.registration.operator_create', 'Operator Parking Registration Create', 'parking', 'registration.operator_create'],

  ['device.read', 'Device Read', 'device', 'read'],
  ['device.create', 'Device Create', 'device', 'create'],
  ['device.update', 'Device Update', 'device', 'update'],
  ['device.assign', 'Device Assign', 'device', 'assign'],
  ['device.assign_request', 'Device Assign Request', 'device', 'assign_request'],
  ['device.status.read', 'Device Status Read', 'device', 'status.read'],
  ['device.manage', 'Device Manage', 'device', 'manage'],

  ['device.fault.read', 'Device Fault Read', 'device', 'fault.read'],
  ['device.fault.acknowledge', 'Device Fault Acknowledge', 'device', 'fault.acknowledge'],
  ['device.fault.resolve', 'Device Fault Resolve', 'device', 'fault.resolve'],

  ['billing.read', 'Billing Read', 'billing', 'read'],
  ['billing.manage', 'Billing Manage', 'billing', 'manage'],
  ['billing.summary.read', 'Billing Summary Read', 'billing', 'summary.read'],
  ['billing.fee-policy.manage', 'Fee Policy Manage', 'billing', 'fee-policy.manage'],
  ['billing.discount.manage', 'Discount Manage', 'billing', 'discount.manage'],

  ['fee.read', 'Fee Read', 'fee', 'read'],
  ['fee.create', 'Fee Create', 'fee', 'create'],
  ['fee.update', 'Fee Update', 'fee', 'update'],
  ['fee.publish', 'Fee Publish', 'fee', 'publish'],

  ['invoice.read', 'Invoice Read', 'invoice', 'read'],

  ['payment.read', 'Payment Read', 'payment', 'read'],
  ['payment.request', 'Payment Request', 'payment', 'request'],
  ['payment.confirm', 'Payment Confirm', 'payment', 'confirm'],
  ['payment.refund', 'Payment Refund', 'payment', 'refund'],
  ['payment.manage', 'Payment Manage', 'payment', 'manage'],

  ['receipt.read', 'Receipt Read', 'receipt', 'read'],
  ['receipt.issue', 'Receipt Issue', 'receipt', 'issue'],

  ['outstanding.manage', 'Outstanding Manage', 'outstanding', 'manage'],
  ['settlement.manage', 'Settlement Manage', 'settlement', 'manage'],
  ['enforcement.manage', 'Enforcement Manage', 'enforcement', 'manage'],

  ['operator.dashboard.read', 'Operator Dashboard Read', 'operator', 'dashboard.read'],

  ['display.read', 'Display Read', 'display', 'read'],
  ['display.manage', 'Display Manage', 'display', 'manage'],
  ['display.override', 'Display Override', 'display', 'override'],
  ['display.policy.read', 'Display Policy Read', 'display', 'policy.read'],
  ['display.policy.update', 'Display Policy Update', 'display', 'policy.update'],

  ['alert.read', 'Alert Read', 'alert', 'read'],
  ['alert.acknowledge', 'Alert Acknowledge', 'alert', 'acknowledge'],
  ['alert.resolve', 'Alert Resolve', 'alert', 'resolve'],

  ['sync.read', 'Sync Read', 'sync', 'read'],
  ['sync.force_resync', 'Sync Force Resync', 'sync', 'force_resync'],

  ['edge.read', 'Edge Read', 'edge', 'read'],
  ['edge.create', 'Edge Create', 'edge', 'create'],
  ['edge.update', 'Edge Update', 'edge', 'update'],
  ['edge.rotate_key', 'Edge Rotate Key', 'edge', 'rotate_key'],

  ['audit.read', 'Audit Read', 'audit', 'read'],

  ['map.read', 'Map Read', 'map', 'read'],
  ['map.edit', 'Map Edit', 'map', 'edit'],
  ['map.publish', 'Map Publish', 'map', 'publish'],

  ['rbac.read', 'RBAC Read', 'rbac', 'read'],
  ['rbac.update', 'RBAC Update', 'rbac', 'update'],
  ['rbac.manage', 'RBAC Manage', 'rbac', 'manage'],
] as const;

const allPermissionKeys = permissions.map(([key]) => key);

const managerPermissions = [
  'analytics.read',
  'statistics.read',
  'user.read',
  'user.manage',
  'session.manage',
  'device.read',
  'device.status.read',
  'device.manage',
  'device.fault.read',
  'device.fault.acknowledge',
  'device.fault.resolve',
  'billing.read',
  'billing.manage',
  'billing.summary.read',
  'billing.fee-policy.manage',
  'billing.discount.manage',
  'fee.read',
  'payment.read',
  'payment.manage',
  'receipt.read',
  'receipt.issue',
  'outstanding.manage',
  'settlement.manage',
  'enforcement.manage',
  'parking.lot.read',
  'parking.section.read',
  'parking.section.write',
  'parking.zone.read',
  'parking.space.read',
  'parking.space.write',
  'parking.space.override',
  'display.read',
  'display.manage',
  'display.override',
  'alert.read',
  'alert.acknowledge',
  'alert.resolve',
  'sync.read',
];

const operatorPermissions = [
  'operator.dashboard.read',
  'session.manage',
  'parking.lot.read',
  'parking.section.read',
  'parking.zone.read',
  'parking.space.read',
  'parking.space.register',
  'parking.registration.operator_create',
  'parking.session.read',
  'device.read',
  'device.status.read',
  'device.fault.read',
  'device.fault.acknowledge',
  'billing.summary.read',
  'payment.read',
  'payment.manage',
  'display.read',
  'alert.read',
  'alert.acknowledge',
  'alert.resolve',
];

const memberPermissions = [
  'parking.lot.read',
  'parking.section.read',
  'parking.zone.read',
  'parking.space.read',
  'parking.space.register',
  'parking.session.read',
  'fee.read',
  'invoice.read',
  'payment.request',
  'receipt.read',
];

const visitorPermissions = [
  'parking.lot.read',
  'parking.section.read',
  'parking.zone.read',
  'parking.space.read',
  'parking.space.register',
  'parking.session.read',
  'fee.read',
  'invoice.read',
  'payment.request',
  'receipt.read',
];

const rolePermissionMap: Record<string, string[]> = {
  ADMIN: allPermissionKeys,
  SYSTEM_SUPERUSER: allPermissionKeys,
  CLOUD_ADMIN: allPermissionKeys,

  MANAGER: managerPermissions,
  PARKING_MANAGER: managerPermissions,
  TENANT_ADMIN: managerPermissions,

  OPERATOR: operatorPermissions,
  PARKING_OPERATOR: operatorPermissions,

  MEMBER: memberPermissions,
  VISITOR: visitorPermissions,

  EDGE_SERVICE: [
    'parking.lot.read',
    'parking.section.read',
    'parking.zone.read',
    'parking.space.read',
    'parking.session.read',
    'device.read',
    'device.status.read',
    'display.read',
    'sync.read',
  ],

  SYNC_CLIENT: [
    'sync.read',
    'sync.force_resync',
  ],
};

async function upsertRole(role: (typeof roles)[number]) {
  return prisma.role.upsert({
    where: { code: role.code },
    update: {
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
    },
    create: role,
  });
}

async function upsertPermission(permission: (typeof permissions)[number]) {
  const [key, name, module, action] = permission;

  return prisma.permission.upsert({
    where: { key },
    update: {
      name,
      module,
      action,
    },
    create: {
      key,
      name,
      module,
      action,
      description: name,
    },
  });
}

async function assignPermissions(roleCode: string, keys: string[]) {
  const role = await prisma.role.findUniqueOrThrow({
    where: { code: roleCode },
  });

  const foundPermissions = await prisma.permission.findMany({
    where: {
      key: {
        in: keys,
      },
    },
  });

  for (const permission of foundPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: role.id,
        permissionId: permission.id,
      },
    });
  }
}

async function seedMenuPolicy() {
  const menuPolicies = [
    ['ADMIN', 'dashboard', true, 'GLOBAL'],
    ['ADMIN', 'approvals', true, 'GLOBAL'],
    ['ADMIN', 'parking', true, 'GLOBAL'],
    ['ADMIN', 'facilities', true, 'GLOBAL'],
    ['ADMIN', 'devices', true, 'GLOBAL'],
    ['ADMIN', 'fees', true, 'GLOBAL'],
    ['ADMIN', 'users', true, 'GLOBAL'],
    ['ADMIN', 'billing', true, 'GLOBAL'],
    ['ADMIN', 'display', true, 'GLOBAL'],
    ['ADMIN', 'enforcement', true, 'GLOBAL'],
    ['ADMIN', 'rbac', true, 'GLOBAL'],
    ['ADMIN', 'system', true, 'GLOBAL'],

    ['SYSTEM_SUPERUSER', 'dashboard', true, 'GLOBAL'],
    ['SYSTEM_SUPERUSER', 'approvals', true, 'GLOBAL'],
    ['SYSTEM_SUPERUSER', 'parking', true, 'GLOBAL'],
    ['SYSTEM_SUPERUSER', 'facilities', true, 'GLOBAL'],
    ['SYSTEM_SUPERUSER', 'devices', true, 'GLOBAL'],
    ['SYSTEM_SUPERUSER', 'fees', true, 'GLOBAL'],
    ['SYSTEM_SUPERUSER', 'users', true, 'GLOBAL'],
    ['SYSTEM_SUPERUSER', 'billing', true, 'GLOBAL'],
    ['SYSTEM_SUPERUSER', 'display', true, 'GLOBAL'],
    ['SYSTEM_SUPERUSER', 'enforcement', true, 'GLOBAL'],
    ['SYSTEM_SUPERUSER', 'rbac', true, 'GLOBAL'],
    ['SYSTEM_SUPERUSER', 'system', true, 'GLOBAL'],

    ['MANAGER', 'dashboard', true, 'LOT'],
    ['MANAGER', 'approvals', true, 'LOT'],
    ['MANAGER', 'parking', true, 'LOT'],
    ['MANAGER', 'facilities', true, 'LOT'],
    ['MANAGER', 'devices', true, 'LOT'],
    ['MANAGER', 'fees', true, 'LOT'],
    ['MANAGER', 'users', true, 'LOT'],
    ['MANAGER', 'billing', true, 'LOT'],
    ['MANAGER', 'display', true, 'LOT'],
    ['MANAGER', 'enforcement', true, 'LOT'],
    ['MANAGER', 'rbac', false, 'LOT'],
    ['MANAGER', 'system', false, 'LOT'],

    ['PARKING_MANAGER', 'dashboard', true, 'LOT'],
    ['PARKING_MANAGER', 'approvals', true, 'LOT'],
    ['PARKING_MANAGER', 'parking', true, 'LOT'],
    ['PARKING_MANAGER', 'facilities', true, 'LOT'],
    ['PARKING_MANAGER', 'devices', true, 'LOT'],
    ['PARKING_MANAGER', 'fees', true, 'LOT'],
    ['PARKING_MANAGER', 'users', true, 'LOT'],
    ['PARKING_MANAGER', 'billing', true, 'LOT'],
    ['PARKING_MANAGER', 'display', true, 'LOT'],
    ['PARKING_MANAGER', 'enforcement', true, 'LOT'],

    ['OPERATOR', 'dashboard', true, 'SECTION'],
    ['OPERATOR', 'parking', true, 'SECTION'],
    ['OPERATOR', 'facilities', true, 'SECTION'],
    ['OPERATOR', 'devices', true, 'SECTION'],
    ['OPERATOR', 'billing', true, 'SECTION'],
    ['OPERATOR', 'display', true, 'SECTION'],
    ['OPERATOR', 'enforcement', true, 'SECTION'],
    ['OPERATOR', 'approvals', false, 'SECTION'],
    ['OPERATOR', 'rbac', false, 'SECTION'],
    ['OPERATOR', 'system', false, 'SECTION'],

    ['PARKING_OPERATOR', 'dashboard', true, 'SECTION'],
    ['PARKING_OPERATOR', 'parking', true, 'SECTION'],
    ['PARKING_OPERATOR', 'facilities', true, 'SECTION'],
    ['PARKING_OPERATOR', 'devices', true, 'SECTION'],
    ['PARKING_OPERATOR', 'billing', true, 'SECTION'],
    ['PARKING_OPERATOR', 'display', true, 'SECTION'],
    ['PARKING_OPERATOR', 'enforcement', true, 'SECTION'],
  ] as const;

  for (const [roleCode, menuCode, canView, scopeType] of menuPolicies) {
    const role = await prisma.role.findUnique({
      where: { code: roleCode },
    });

    if (!role) continue;

    const menu = await prisma.appMenu.upsert({
      where: { code: menuCode },
      update: {
        name: menuCode,
        isVisible: true,
      },
      create: {
        code: menuCode,
        name: menuCode,
        sortOrder: 0,
        isVisible: true,
      },
    });

    await prisma.roleMenuPolicy.upsert({
      where: {
        roleId_menuId: {
          roleId: role.id,
          menuId: menu.id,
        },
      },
      update: {
        canView,
        scopeType,
      },
      create: {
        roleId: role.id,
        menuId: menu.id,
        canView,
        scopeType,
      },
    });
  }
}

async function main() {
  for (const role of roles) {
    await upsertRole(role);
  }

  for (const permission of permissions) {
    await upsertPermission(permission);
  }

  for (const [roleCode, keys] of Object.entries(rolePermissionMap)) {
    await assignPermissions(roleCode, keys);
  }

  await seedMenuPolicy();

  console.log('RBAC seed completed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });