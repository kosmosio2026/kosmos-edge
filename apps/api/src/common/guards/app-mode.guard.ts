import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { APP_MODE_KEY } from '../decorators/app-mode.decorator';
import { getAppMode, getAppProfile, type AppProfile } from '../config/app-mode';

@Injectable()
export class AppModeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedProfiles = this.reflector.getAllAndOverride<AppProfile[]>(
      APP_MODE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!allowedProfiles || allowedProfiles.length === 0) {
      return true;
    }

    const currentProfile = getAppProfile();
    const currentMode = getAppMode();

    if (
      !allowedProfiles.includes(currentProfile) &&
      !allowedProfiles.includes(currentMode)
    ) {
      throw new ForbiddenException(
        `This endpoint is not available in ${currentProfile} profile`,
      );
    }

    return true;
  }
}
