import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/require-permission.decorator';
import { RbacService } from '../../modules/rbac/rbac.service';
import { AuthUser } from '../types/auth-user.type';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
  const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
    REQUIRED_PERMISSIONS_KEY,
    [context.getHandler(), context.getClass()],
  );

  const request = context.switchToHttp().getRequest();
  const user = request.user as AuthUser | undefined;

  if (!user) {
    throw new ForbiddenException('Authentication required');
  }

  if (!user.isApproved) {
    throw new ForbiddenException('User not approved');
  }

  if (!requiredPermissions?.length) return true;

  const ok = await this.rbacService.hasPermissions(
    user.sub,
    requiredPermissions,
  );

  if (!ok) {
    throw new ForbiddenException('Missing required permissions');
  }

  return true;
  }
}
