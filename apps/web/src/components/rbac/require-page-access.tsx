'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { visibleConsoleMenus as consoleMenus } from '@/lib/console-menu';

export function RequirePageAccess({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();

  const allowed = useMemo(() => {
    if (!user) return false;
    if (user.roles.includes('ADMIN')) return true;

    const menu = consoleMenus.find((item) => item.href === pathname);

    if (!menu) return true;

    if (!menu.roles.some((role) => user.roles.includes(role))) {
      return false;
    }

    if (menu.permission && !user.permissions.includes(menu.permission)) {
      return false;
    }

    if (menu.scopeLevel === 'lot') {
      return (user.scopes?.parkingLotIds?.length ?? 0) > 0;
    }

    if (menu.scopeLevel === 'section') {
      return (
        (user.scopes?.parkingSectionIds?.length ?? 0) > 0 ||
        (user.scopes?.parkingLotIds?.length ?? 0) > 0
      );
    }

    return true;
  }, [pathname, user]);

  if (!allowed) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="rounded-3xl border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">접근 권한 없음</h1>
          <p className="mt-2 text-sm text-slate-500">
            이 페이지에 접근할 권한이 없습니다.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}