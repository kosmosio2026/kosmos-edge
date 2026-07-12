'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { AppShell } from './app-shell';
import { RequirePageAccess } from '@/components/rbac/require-page-access';

const PUBLIC_PATHS = [
  '/login',
  '/register',

  '/admin/login',
  '/admin/setup/register',

  '/manager/login',
  '/manager/register',

  '/operator/login',
  '/operator/register',

  '/visitor/login',
  '/visitor/register',
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function AppShellWrapper({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isReady, isAuthenticated } = useAuth();

  const publicPage = isPublicPath(pathname);

  useEffect(() => {
    if (publicPage) return;
    if (!isReady) return;

    if (!isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [publicPage, isReady, isAuthenticated, pathname, router]);

  if (publicPage) {
    return <>{children}</>;
  }

  if (!isReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-2xl bg-white px-6 py-4 text-sm text-slate-500 shadow-sm">
          Loading session...
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AppShell>
      <RequirePageAccess>{children}</RequirePageAccess>
    </AppShell>
  );
}