import { SetMetadata } from "@nestjs/common";
import type { AppMode } from "../config/app-mode";

export const APP_MODE_KEY = "app_mode";

export function AppModeOnly(...modes: AppMode[]) {
  return SetMetadata(APP_MODE_KEY, modes);
}