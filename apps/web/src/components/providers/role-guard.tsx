'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';

type RoleGuardProps = {
  requiredRole: 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'MEMBER' | 'VISITOR';
  loginPath: string;
  children: React.ReactNode;
};

function normalizeRoles(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((role) => String(role).toUpperCase());
}

export function RoleGuard({
  requiredRole,
  loginPath,
  children,
}: RoleGuardProps) {
  const pathname = usePathname();
  const { session, user, isReady, logout } = useAuth();

  const roles = normalizeRoles(user?.roles);
  const hasRequiredRole = roles.includes(requiredRole);

  useEffect(() => {
    if (!isReady) return;

    if (!session?.accessToken) {
      const redirect = encodeURIComponent(pathname);
      window.location.replace(`${loginPath}?redirect=${redirect}`);
      return;
    }

    if (!hasRequiredRole) {
      logout(`${loginPath}?reason=forbidden`);
    }
  }, [
    isReady,
    session?.accessToken,
    hasRequiredRole,
    loginPath,
    logout,
    pathname,
  ]);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading...
      </div>
    );
  }

  if (!session?.accessToken || !hasRequiredRole) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Redirecting...
      </div>
    );
  }

  return <>{children}</>;
}