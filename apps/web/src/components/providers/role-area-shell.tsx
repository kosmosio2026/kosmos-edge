'use client';

import { useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { useAuth } from '@/components/providers/auth-provider';

type ConsoleRole = 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'MEMBER' | 'VISITOR';

type RoleAreaShellProps = {
  requiredRole: ConsoleRole;
  loginPath: string;
  children: React.ReactNode;
  withAppShell?: boolean;
};

const PUBLIC_SUFFIXES = [
  '/login',
  '/register',
  '/forgot-password',
];

const ROLE_ALIASES: Record<ConsoleRole, string[]> = {
  ADMIN: [
    'ADMIN',
    'SUPER_ADMIN',
    'SYSTEM_ADMIN',
  ],
  MANAGER: [
    'MANAGER',
    'PARKING_MANAGER',
    'LOT_MANAGER',
  ],
  OPERATOR: [
    'OPERATOR',
    'PARKING_OPERATOR',
    'FIELD_OPERATOR',
    'PARKING_ATTENDANT',
  ],
  MEMBER: [
    'MEMBER',
    'CUSTOMER',
    'USER',
  ],
  VISITOR: [
    'VISITOR',
    'GUEST',
  ],
};

function roleToCode(role: unknown): string | null {
  if (!role) return null;

  if (typeof role === 'string') {
    return role.toUpperCase();
  }

  if (typeof role === 'object') {
    const value = role as Record<string, unknown>;

    const code =
      value.code ??
      value.roleCode ??
      value.name ??
      value.role ??
      value.authority;

    if (typeof code === 'string') {
      return code.toUpperCase();
    }
  }

  return null;
}

function normalizeRoles(...sources: unknown[]): string[] {
  const result = new Set<string>();

  for (const source of sources) {
    if (!source) continue;

    if (Array.isArray(source)) {
      for (const item of source) {
        const code = roleToCode(item);

        if (code) {
          result.add(code);
        }
      }

      continue;
    }

    const code = roleToCode(source);

    if (code) {
      result.add(code);
    }
  }

  return Array.from(result);
}

function isPublicRolePath(pathname: string, loginPath: string) {
  if (pathname === loginPath) return true;

  return PUBLIC_SUFFIXES.some((suffix) => pathname.endsWith(suffix));
}

function hasRequiredRole(roles: string[], requiredRole: ConsoleRole) {
  const aliases = ROLE_ALIASES[requiredRole];
  return aliases.some((alias) => roles.includes(alias));
}

export function RoleAreaShell({
  requiredRole,
  loginPath,
  children,
  withAppShell = true,
}: RoleAreaShellProps) {
  const pathname = usePathname();
  const { session, user, isReady, logout } = useAuth();

  const isPublicPage = isPublicRolePath(pathname, loginPath);

  const roles = useMemo(
    () =>
      normalizeRoles(
        user?.roles,
        (user as any)?.role,
        (user as any)?.roleCode,
        (user as any)?.authorities,
        (session as any)?.roles,
        (session as any)?.role,
        (session as any)?.roleCode,
        (session as any)?.authorities,
        (session as any)?.user?.roles,
        (session as any)?.user?.role,
        (session as any)?.user?.roleCode,
        (session as any)?.user?.authorities,
      ),
    [session, user],
  );

  const allowed = hasRequiredRole(roles, requiredRole);
  const hasAccessToken = Boolean(session?.accessToken);

  useEffect(() => {
    if (isPublicPage) return;
    if (!isReady) return;

    console.info('[RoleAreaShell]', {
      pathname,
      requiredRole,
      roles,
      hasAccessToken,
      allowed,
    });

    if (!hasAccessToken) {
      const redirect = encodeURIComponent(pathname);
      window.location.replace(`${loginPath}?redirect=${redirect}`);
      return;
    }

    if (!allowed) {
      logout(`${loginPath}?reason=forbidden`);
    }
  }, [
    isPublicPage,
    isReady,
    hasAccessToken,
    allowed,
    requiredRole,
    roles,
    loginPath,
    logout,
    pathname,
  ]);

  /*
   Important:
   Do not return before hooks.
   /admin/login, /manager/login, /operator/login are inside their role route trees,
   so they pass through role layouts too. Login/register pages must bypass guard
   and must not be wrapped by AppShell.
  */
  if (isPublicPage) {
    return <>{children}</>;
  }

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading...
      </div>
    );
  }

  if (!hasAccessToken || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Redirecting...
      </div>
    );
  }

  if (!withAppShell) {
    return <>{children}</>;
  }

  return <AppShell>{children}</AppShell>;
}