import type { AuthUser, LoginRole } from '@/types/auth';

export function hasRole(user: AuthUser | null, roles: LoginRole[]) {
  if (!user) return false;

  return roles.some((role) => user.roles.includes(role));
}

export function hasPermission(user: AuthUser | null, permissions: string[]) {
  if (!user) return false;

  if (user.roles.includes('ADMIN')) return true;

  return permissions.every((permission) =>
    user.permissions.includes(permission),
  );
}