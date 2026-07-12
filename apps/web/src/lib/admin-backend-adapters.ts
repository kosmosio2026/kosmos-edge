export const adminBackendCandidates = {
  approvals: {
    managerList: [
      '/approval/managers/pending',
      '/approvals/managers',
      '/approval/requests/managers',
    ],
    operatorList: [
      '/approval/operators/pending',
      '/approvals/operators',
      '/approval/requests/operators',
    ],
    approve: [
      '/approval/requests/{id}/approve',
      '/approvals/{id}/approve',
    ],
    reject: [
      '/approval/requests/{id}/reject',
      '/approvals/{id}/reject',
    ],
  },

  facilities: {
    lots: {
      list: ['/facilities/lots', '/facilities/lots'],
      create: ['/facilities/lots', '/facilities/lots'],
      update: ['/facilities/lots/{id}', '/facilities/lots/{id}'],
      delete: ['/facilities/lots/{id}', '/facilities/lots/{id}'],
    },
    sections: {
      list: ['/facilities/sections', '/facilities/sections'],
      create: ['/facilities/sections', '/facilities/sections'],
      update: ['/facilities/sections/{id}', '/facilities/sections/{id}'],
      delete: ['/facilities/sections/{id}', '/facilities/sections/{id}'],
    },
    spaces: {
      list: ['/facilities/spaces', '/facilities/spaces'],
      create: ['/facilities/spaces', '/facilities/spaces'],
      update: ['/facilities/spaces/{id}', '/facilities/spaces/{id}'],
      delete: ['/facilities/spaces/{id}', '/facilities/spaces/{id}'],
    },
  },

  deviceFaults: {
    list: ['/devices/faults', '/device-faults'],
    action: [
      '/devices/faults/{id}/action',
      '/device-faults/{id}/action',
      '/devices/faults/{id}',
    ],
  },

  feePolicies: {
    list: ['/billing/fee-policies', '/fees/policies'],
    create: ['/billing/fee-policies', '/fees/policies'],
    update: ['/billing/fee-policies/{id}', '/fees/policies/{id}'],
    delete: ['/billing/fee-policies/{id}', '/fees/policies/{id}'],
  },

  users: {
    members: ['/users/members', '/admin/users/members'],
    visitors: ['/users/visitors', '/admin/users/visitors'],
    detail: ['/users/{id}', '/admin/users/{id}'],
    update: ['/users/{id}', '/admin/users/{id}'],
    scopes: [
      '/rbac/users/{id}/scopes',
      '/users/{id}/scopes',
      '/admin/users/{id}/scopes',
    ],
  },
} as const;