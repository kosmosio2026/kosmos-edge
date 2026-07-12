import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { APP_MODE_KEY } from "../decorators/app-mode.decorator";
import { getAppMode, type AppMode } from "../config/app-mode";

@Injectable()
export class AppModeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const allowedModes = this.reflector.getAllAndOverride<AppMode[]>(
      APP_MODE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!allowedModes || allowedModes.length === 0) {
      return true;
    }

    const currentMode = getAppMode();

    if (!allowedModes.includes(currentMode)) {
      throw new ForbiddenException(
        `This endpoint is not available in ${currentMode} mode`,
      );
    }

    return true;
  }
}