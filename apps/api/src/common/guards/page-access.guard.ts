import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PAGE_ACCESS_KEY,
  PageAccessRequirement,
} from '../decorators/require-page-access.decorator';
import { RbacService } from '../../modules/rbac/rbac.service';
import { AuthUser } from '../types/auth-user.type';

@Injectable()
export class PageAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<PageAccessRequirement>(
      PAGE_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requirement) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser | undefined;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const ok = await this.rbacService.hasPageAccess(
      user.sub,
      requirement.pageCode,
      requirement.action ?? 'view',
    );

    if (!ok) {
      throw new ForbiddenException('Page access denied');
    }

    return true;
  }
}
