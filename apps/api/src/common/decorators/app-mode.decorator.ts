import { SetMetadata } from '@nestjs/common';
import type { AppMode, AppProfile } from '../config/app-mode';

export const APP_MODE_KEY = 'app_mode';
export const APP_PROFILE_KEY = APP_MODE_KEY;

export function AppModeOnly(...modes: AppMode[]) {
  return SetMetadata(APP_MODE_KEY, modes);
}

export function AppProfileOnly(...profiles: AppProfile[]) {
  return SetMetadata(APP_PROFILE_KEY, profiles);
}
