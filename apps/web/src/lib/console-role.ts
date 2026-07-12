export type ConsoleRole = 'admin' | 'manager' | 'operator';

export function isReadOnlyRole(role: ConsoleRole) {
  return role === 'operator';
}

export function canManageFacilities(role: ConsoleRole) {
  return role === 'admin' || role === 'manager';
}

export function canManageBilling(role: ConsoleRole) {
  return role === 'admin' || role === 'manager';
}

export function canManageUsers(role: ConsoleRole) {
  return role === 'admin' || role === 'manager';
}

export function canManageDevices(role: ConsoleRole) {
  return role === 'admin' || role === 'manager';
}
