'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { getVisibleConsoleMenuGroups } from '@/lib/console-menu';

type SidebarMenuItem = {
  href: string;
  label: string;
  description?: string;
};

function matchesMenuHref(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getActiveMenuHref(
  pathname: string,
  menus: SidebarMenuItem[],
) {
  const matched = menus
    .filter((menu) => matchesMenuHref(pathname, menu.href))
    .sort((a, b) => b.href.length - a.href.length);

  return matched[0]?.href ?? null;
}

const groupTitles: Record<string, string> = {
  dashboard: '대시보드',
  approvals: '승인 관리',
  facilities: '시설 관리',
  devices: '장치 관리',
  fees: '요금 관리',
  users: '사용자 관리',
  operator: '운영자',
  billing: '정산/결제',
  display: '전광판',
  operations: '운영',
  enforcement: '주차 단속/등록',
  system: '시스템',
  settings: '설정',
};

export function AppSidebar() {
  const pathname = usePathname();
  const { session } = useAuth();
  const groups = getVisibleConsoleMenuGroups(session?.user);

  const activeHref = useMemo(() => {
    const flatMenus = Object.values(groups).flat() as SidebarMenuItem[];
    return getActiveMenuHref(pathname, flatMenus);
  }, [groups, pathname]);

  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-slate-950 text-slate-100 md:block">
      <div className="border-b border-slate-800 px-6 py-5">
        <div className="text-lg font-semibold">Kosmos Parking</div>
        <div className="mt-1 text-xs text-slate-400">
          {session?.user?.roles?.join(', ') ?? 'Guest'}
        </div>
      </div>

      <nav className="space-y-6 p-4">
        {Object.entries(groups).map(([groupKey, menus]) => {
          if (!menus.length) return null;

          return (
            <div key={groupKey}>
              <div className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                {groupTitles[groupKey] ?? groupKey}
              </div>

              <div className="space-y-1">
                {menus.map((menu) => {
                  const active = activeHref === menu.href;

                  return (
                    <Link
                      key={`${groupKey}:${menu.href}:${menu.label}`}
                      href={menu.href}
                      className={[
                        'block rounded-xl px-4 py-3 text-sm transition',
                        active
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-300 hover:bg-slate-900 hover:text-white',
                      ].join(' ')}
                    >
                      <div className="font-medium">{menu.label}</div>
                      {menu.description ? (
                        <div className="mt-0.5 text-[11px] text-slate-400">
                          {menu.description}
                        </div>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
