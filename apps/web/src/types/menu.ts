import type { LucideIcon } from 'lucide-react';
import type { LoginRole } from './auth';

export interface AppMenuItem {
  key: string;
  label: string;
  href: string;
  icon?: LucideIcon;
  permissions?: string[];
  roles?: LoginRole[];
  children?: AppMenuItem[];
}