import { SetMetadata } from '@nestjs/common';
import type { PermissionKey } from '../rbac/permissions';

export const REQUIRED_PERMISSIONS_KEY = 'required_permissions';
export const PERMISSIONS_KEY = REQUIRED_PERMISSIONS_KEY;

export const RequirePermission = (...permissions: PermissionKey[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);