'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/operator', label: '홈' },
  { href: '/operator/dashboard', label: '대시보드' },
  { href: '/operator/grid', label: '주차면 현황' },
  { href: '/operator/map', label: '지도 보기' },
  { href: '/operator/parking/sessions', label: '주차 현황' },
  { href: '/operator/parking/history', label: '주차 이력' },
  { href: '/operator/billing', label: '수금 관리' },
  { href: '/operator/devices/faults', label: '장애 관리' },
  { href: '/operator/requests/sections', label: '구역 요청' },
  { href: '/operator/profile', label: '회원 정보' },
];

function clearKosmosSession() {
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (
        key.startsWith('kosmos') ||
        key.startsWith('parking') ||
        key.includes('accessToken') ||
        key.includes('refreshToken') ||
        key.includes('session')
      ) {
        window.localStorage.removeItem(key);
      }
    }

    for (const key of Object.keys(window.sessionStorage)) {
      if (
        key.startsWith('kosmos') ||
        key.startsWith('parking') ||
        key.includes('accessToken') ||
        key.includes('refreshToken') ||
        key.includes('session')
      ) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // ignore storage errors
  }
}

export function OperatorTabletNav() {
  const pathname = usePathname();

  const logout = () => {
    clearKosmosSession();
    window.location.href = '/operator';
  };

  return (
    <nav className="border-b border-slate-200 bg-white px-6 py-3">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {navItems.map((item) => {
            const active =
              item.href === '/operator'
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'rounded-xl px-4 py-2 text-sm font-black transition',
                  active
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950',
                ].join(' ')}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <button
          type="button"
          onClick={logout}
          className="self-start whitespace-nowrap rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-red-700 hover:bg-red-100 lg:self-auto"
        >
          로그아웃
        </button>
      </div>
    </nav>
  );
}
