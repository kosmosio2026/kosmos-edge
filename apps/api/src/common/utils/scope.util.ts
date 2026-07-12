import { AuthUser } from '../types/auth-user.type';

export function buildLotScopeWhere(user: AuthUser) {
  if (user.roles.includes('ADMIN')) return {};

  if (user.roles.includes('MANAGER')) {
    return {
      id: { in: user.scopes?.parkingLotIds ?? [] },
    };
  }

  return {
    id: { in: user.scopes?.parkingLotIds ?? [] },
  };
}