'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

type MobileSessionType = 'member' | 'visitor' | 'none';

type Props = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  sessionType?: MobileSessionType;
};

function isActive(pathname: string, href: string) {
  if (href === '/mobile') return pathname === '/mobile';
  return pathname.startsWith(href);
}

function itemClass(active: boolean) {
  return [
    'flex flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-black',
    active ? 'bg-slate-50 text-slate-950' : 'text-slate-500',
  ].join(' ');
}

export function MobileAppShell({
  children,
  title = 'Kosmos Parking',
  subtitle = '모바일 주차 서비스',
  sessionType,
}: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [detectedSessionType, setDetectedSessionType] =
    useState<MobileSessionType>('none');

  useEffect(() => {
    const memberToken = localStorage.getItem('kosmos.mobileAccessToken');
    const visitorToken = localStorage.getItem('kosmos.visitorAccessToken');

    if (memberToken) {
      setDetectedSessionType('member');
      return;
    }

    if (visitorToken) {
      setDetectedSessionType('visitor');
      return;
    }

    setDetectedSessionType('none');
  }, []);

  const effectiveSessionType = sessionType ?? detectedSessionType;

  const items =
    effectiveSessionType === 'member'
      ? [
          { href: '/mobile', label: '홈', icon: '⌂' },
          { href: '/mobile/parking/select', label: '주차등록', icon: '＋' },
          { href: '/mobile/parking/current', label: '주차현황', icon: '●' },
          { href: '/mobile/payments', label: '결제/영수증', icon: '₩' },
          { href: '/mobile/member/vehicles', label: '내차량', icon: '▣' },
        ]
      : effectiveSessionType === 'visitor'
        ? [
            { href: '/mobile', label: '홈', icon: '⌂' },
            { href: '/mobile/parking/select', label: '주차등록', icon: '＋' },
            { href: '/mobile/parking/current', label: '주차현황', icon: '●' },
            { href: '/mobile/payments', label: '결제/영수증', icon: '₩' },
            { href: '/mobile/visitor/history', label: '주차이력', icon: '≡' },
          ]
        : [
            { href: '/mobile', label: '홈', icon: '⌂' },
            { href: '/mobile/parking/select', label: '주차등록', icon: '＋' },
            { href: '/mobile/member/login', label: '회원', icon: 'M' },
            { href: '/mobile/visitor/login', label: '방문', icon: 'V' },
          ];

  return (
    <main
      data-kosmos-mobile-shell
      className="min-h-screen pt-[env(safe-area-inset-top)] bg-slate-50 px-4 py-4 pb-28 text-slate-950"
    >
      <div className="mx-auto max-w-md">
        <header
          data-kosmos-mobile-header
          className="mb-4 rounded-[1.75rem] bg-white p-4 shadow-xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-blue-600">
                KOSMOS PARKING
              </p>
              <h1 className="mt-2 text-xl font-black text-slate-950">{title}</h1>
              <p className="mt-1 text-xs font-bold text-slate-500">{subtitle}</p>
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="rounded-2xl bg-slate-100 px-3 py-2 text-lg font-black text-slate-700"
              aria-label="메뉴 열기"
            >
              ☰
            </button>
          </div>

          {menuOpen ? (
            <div
              data-kosmos-mobile-menu
              className="mt-4 grid gap-2 rounded-3xl bg-slate-50 p-3 text-sm font-black"
            >
              <a href="/mobile/parking/select" className="rounded-2xl bg-white px-4 py-3 text-slate-800">
                주차장 선택
              </a>

              {effectiveSessionType === 'member' ? (
                <>
                  <a href="/mobile/member/profile" className="rounded-2xl bg-white px-4 py-3 text-slate-800">
                    내 정보
                  </a>
                  <a href="/mobile/member/vehicles" className="rounded-2xl bg-white px-4 py-3 text-slate-800">
                    내 차량
                  </a>
                  <a href="/mobile/member/history" className="rounded-2xl bg-white px-4 py-3 text-slate-800">
                    주차 이력
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem('kosmos.mobileAccessToken');
                      localStorage.removeItem('kosmos.mobileUser');
                      window.location.href = '/mobile';
                    }}
                    className="rounded-2xl bg-white px-4 py-3 text-left text-red-600"
                  >
                    로그아웃
                  </button>
                </>
              ) : null}

              {effectiveSessionType === 'visitor' ? (
                <>
                  <a href="/mobile/visitor/history" className="rounded-2xl bg-white px-4 py-3 text-slate-800">
                    주차 이력
                  </a>
                  <a href="/mobile/payments" className="rounded-2xl bg-white px-4 py-3 text-slate-800">
                    결제/영수증
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem('kosmos.visitorAccessToken');
                      localStorage.removeItem('kosmos.visitorSession');
                      window.location.href = '/mobile';
                    }}
                    className="rounded-2xl bg-white px-4 py-3 text-left text-red-600"
                  >
                    로그아웃
                  </button>
                </>
              ) : null}

              {effectiveSessionType === 'none' ? (
                <>
                  <a href="/mobile/member/login" className="rounded-2xl bg-white px-4 py-3 text-blue-700">
                    회원 로그인
                  </a>
                  <a href="/mobile/visitor/login" className="rounded-2xl bg-white px-4 py-3 text-blue-700">
                    방문객 로그인
                  </a>
                </>
              ) : null}

              <div className="my-1 border-t border-slate-200" />

              <a href="/mobile/terms" className="rounded-2xl bg-white px-4 py-3 text-slate-700">
                이용약관
              </a>
              <a href="/mobile/privacy" className="rounded-2xl bg-white px-4 py-3 text-slate-700">
                개인정보처리방침
              </a>
              <a href="/mobile/location-terms" className="rounded-2xl bg-white px-4 py-3 text-slate-700">
                위치기반서비스 이용약관
              </a>
            </div>
          ) : null}
        </header>

        {children}

        <footer
          data-kosmos-mobile-legal-footer
          className="mt-5 rounded-[1.5rem] bg-white/90 p-4 text-center text-[11px] font-bold leading-5 text-slate-400 shadow-xl"
        >
          <p>© 2026 Kosmos Parking. All rights reserved.</p>
          <div className="mt-2 flex items-center justify-center gap-3">
            <a href="/mobile/terms" className="text-slate-500 underline-offset-4 hover:underline">
              이용약관
            </a>
            <a href="/mobile/privacy" className="text-slate-500 underline-offset-4 hover:underline">
              개인정보처리방침
            </a>
            <a href="/mobile/location-terms" className="text-slate-500 underline-offset-4 hover:underline">
              위치기반서비스
            </a>
          </div>
        </footer>
      </div>

      <nav
        data-kosmos-mobile-bottom-nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-3 py-3 shadow-2xl backdrop-blur"
      >
        <div
          className="mx-auto grid max-w-md gap-1"
          style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
        >
          {items.map((item) => {
            const href =
              item.href;

            return (
              <a
                key={item.href}
                href={href}
                className={itemClass(isActive(pathname, item.href))}
              >
                <span className="text-sm leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </a>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
