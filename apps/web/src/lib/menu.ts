import {
  Cpu,
  Monitor,
  Gauge,
  LayoutDashboard,
  ParkingCircle,
  Receipt,
  ShieldAlert,
  Users,
  KeyRound,
  MonitorCog,
  Settings,
} from 'lucide-react';

import type { AppMenuItem } from '@/types/menu';
import { hasPermission, hasRole } from './roles';
import type { AuthUser } from '@/types/auth';

export const appMenus: AppMenuItem[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
  },

  {
    key: 'parking',
    label: 'Parking',
    href: '/admin/dashboard/facilities/lots',
    icon: ParkingCircle,
    permissions: ['parking.lot.read'],
    children: [
      {
        key: 'parking-lots',
        label: 'Parking Lots',
        href: '/admin/dashboard/facilities/lots',
        permissions: ['parking.lot.read'],
      },
      {
        key: 'parking-sections',
        label: 'Sections',
        href: '/admin/dashboard/facilities/sections',
        permissions: ['parking.section.read'],
      },
      {
        key: 'parking-spaces',
        label: 'Spaces',
        href: '/admin/dashboard/facilities/spaces',
        permissions: ['parking.space.read'],
      },
    ],
  },

  {
    key: 'devices',
    label: 'Devices',
    href: '/admin/dashboard/devices',
    icon: Cpu,
    permissions: ['device.manage'],
    children: [
      {
        key: 'device-list',
        label: 'Device List',
        href: '/admin/dashboard/devices',
        permissions: ['device.manage'],
      },
      {
        key: 'device-faults',
        label: 'Fault Management',
        href: '/admin/dashboard/devices/faults',
        permissions: ['device.manage'],
      },
    ],
  },

  {
    key: 'billing',
    label: 'Billing',
    href: '/admin/dashboard/billing/summary',
    icon: Receipt,
    permissions: ['billing.summary.read'],
  },

  {
    key: 'operator',
    label: 'Operator',
    href: '/operator/dashboard',
    icon: Gauge,
    permissions: ['operator.dashboard.read'],
  },

  {
    key: 'enforcement',
    label: 'Enforcement',
    href: '/admin/dashboard/enforcement',
    icon: ShieldAlert,
    permissions: ['enforcement.manage'],
  },

  {
    key: 'display',
    label: 'Display Boards',
    href: '/admin/dashboard/display',
    icon: Monitor,
    permissions: ['display.read'],
  },

  {
    key: 'users',
    label: 'Users',
    href: '/admin/dashboard/users',
    icon: Users,
    permissions: ['user.manage'],
  },

  {
    key: 'rbac',
    label: 'Access Control',
    href: '/admin/dashboard/rbac/admin-page',
    icon: KeyRound,
    permissions: ['rbac.manage'],
  },

  {
    key: 'settings',
    label: 'Settings',
    href: '/admin/dashboard/settings',
    icon: Settings,
  },
];

export function filterMenusByAccess(user: AuthUser | null) {
  return appMenus
    .filter((menu) => {
      const roleOk = menu.roles
        ? hasRole(user, menu.roles)
        : true;

      const permissionOk = menu.permissions
        ? hasPermission(user, menu.permissions)
        : true;

      return roleOk && permissionOk;
    })
    .map((menu) => ({
      ...menu,
      children: menu.children?.filter((child) => {
        const roleOk = child.roles
          ? hasRole(user, child.roles)
          : true;

        const permissionOk = child.permissions
          ? hasPermission(user, child.permissions)
          : true;

        return roleOk && permissionOk;
      }),
    }));
}