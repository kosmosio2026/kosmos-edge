import type { AuthUser } from '@/types/auth';
import type { UserRole } from '@/types/operator';

export function hasRole(user: AuthUser | null | undefined, roles: UserRole[]) {
  if (!user) return false;

  return roles.some((role) => user.roles.includes(role));
}

export function hasPermission(
  user: AuthUser | null | undefined,
  permissions: string[],
) {
  if (!user) return false;
  if (user.roles.includes('ADMIN')) return true;

  return permissions.some((permission) => user.permissions.includes(permission));
}

export function canSeeMenu(
  user: AuthUser | null | undefined,
  item: {
    roles?: UserRole[];
    permissions?: string[];
  },
) {
  const rolePass = !item.roles || hasRole(user, item.roles);
  const permissionPass =
    !item.permissions || hasPermission(user, item.permissions);

  return rolePass && permissionPass;
}