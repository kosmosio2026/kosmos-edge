'use client';

import { APP_VERSION } from '@/lib/app-version';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

type MobileSessionType = 'member' | 'visitor' | 'none';

type Props = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  sessionType?: MobileSessionType;
};

type MobileNavItem = {
  href: string;
  label: string;
  icon: string;
};

const legalLinks = [
  { href: '/mobile/terms', label: '이용약관' },
  { href: '/mobile/privacy', label: '개인정보처리방침' },
  { href: '/mobile/location-terms', label: '위치기반서비스 이용약관' },
  { href: '/electronic-finance-terms', label: '전자금융거래 이용약관' },
];

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

function menuLinkClassName(tone: 'default' | 'primary' | 'danger' = 'default') {
  if (tone === 'primary') {
    return 'rounded-2xl bg-white px-4 py-3 text-blue-700';
  }

  if (tone === 'danger') {
    return 'rounded-2xl bg-white px-4 py-3 text-left text-red-600';
  }

  return 'rounded-2xl bg-white px-4 py-3 text-slate-800';
}

export function MobileAppShell({
  children,
  title = 'KOSMOS 주차관제 서비스',
  subtitle = '모바일 주차 서비스',
  sessionType,
}: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [detectedSessionType, setDetectedSessionType] = useState<MobileSessionType>('none');

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

  const items = useMemo<MobileNavItem[]>(() => {
    if (effectiveSessionType === 'member') {
      return [
        { href: '/mobile', label: '홈', icon: '⌂' },
        { href: '/mobile/parking/select', label: '주차등록', icon: '＋' },
        { href: '/mobile/parking/current', label: '주차현황', icon: '●' },
        { href: '/mobile/payments', label: '요금결제', icon: '₩' },
      ];
    }

    if (effectiveSessionType === 'visitor') {
      return [
        { href: '/mobile', label: '홈', icon: '⌂' },
        { href: '/mobile/parking/select', label: '주차등록', icon: '＋' },
        { href: '/mobile/parking/current', label: '주차현황', icon: '●' },
        { href: '/mobile/payments', label: '요금결제', icon: '₩' },
        { href: '/mobile/visitor/history', label: '주차이력', icon: '≡' },
      ];
    }

    return [
      { href: '/mobile', label: '홈', icon: '⌂' },
      { href: '/mobile/parking/select', label: '주차등록', icon: '＋' },
      { href: '/mobile/member/login', label: '회원', icon: 'M' },
      { href: '/mobile/visitor/login', label: '방문', icon: 'V' },
    ];
  }, [effectiveSessionType]);

  function logoutMember() {
    localStorage.removeItem('kosmos.mobileAccessToken');
    localStorage.removeItem('kosmos.mobileUser');
    window.location.href = '/mobile';
  }

  function logoutVisitor() {
    localStorage.removeItem('kosmos.visitorAccessToken');
    localStorage.removeItem('kosmos.visitorSession');
    window.location.href = '/mobile';
  }

  return (
    <main
      data-kosmos-mobile-shell
      className="min-h-screen bg-slate-50 px-4 py-4 pb-28 pt-[env(safe-area-inset-top)] text-slate-950"
    >
      <div className="mx-auto max-w-md">
        <header
          data-kosmos-mobile-header
          className="mb-4 rounded-[1.75rem] bg-white p-4 shadow-xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.28em] text-blue-600">
                KOSMOS 스마트 주차 서비스
              </p>
              <h1 className="mt-2 text-xl font-black text-slate-950">{title}</h1>
              <p className="mt-1 text-xs font-bold text-slate-500">{subtitle}</p>
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="rounded-2xl bg-slate-100 px-3 py-2 text-lg font-black text-slate-700"
              aria-label={menuOpen ? '메뉴 닫기' : '메뉴 열기'}
              aria-expanded={menuOpen}
            >
              ☰
            </button>
          </div>

          {menuOpen ? (
            <div
              data-kosmos-mobile-menu
              className="mt-4 grid gap-2 rounded-3xl bg-slate-50 p-3 text-sm font-black"
            >
              <a href="/mobile/parking/select" className={menuLinkClassName()}>
                주차장 선택
              </a>

              {effectiveSessionType === 'member' ? (
                <>
                  <a href="/mobile/member/profile" className={menuLinkClassName()}>
                    내 정보
                  </a>
                  <a href="/mobile/member/password-reset" className={menuLinkClassName()}>
                    비밀번호 변경
                  </a>
                  <a href="/mobile/payments" className={menuLinkClassName('primary')}>
                    청구서
                  </a>
                  <a href="/mobile/member/history" className={menuLinkClassName()}>
                    주차 이력
                  </a>
                  <button type="button" onClick={logoutMember} className={menuLinkClassName('danger')}>
                    로그아웃
                  </button>
                </>
              ) : null}

              {effectiveSessionType === 'visitor' ? (
                <>
                  <a href="/mobile/visitor/history" className={menuLinkClassName()}>
                    주차 이력
                  </a>
                  <a href="/mobile/payments" className={menuLinkClassName()}>
                    청구서
                  </a>
                  <button type="button" onClick={logoutVisitor} className={menuLinkClassName('danger')}>
                    로그아웃
                  </button>
                </>
              ) : null}

              {effectiveSessionType === 'none' ? (
                <>
                  <a href="/mobile/member/login" className={menuLinkClassName('primary')}>
                    회원 로그인
                  </a>
                  <a href="/mobile/visitor/login" className={menuLinkClassName('primary')}>
                    방문객 로그인
                  </a>
                </>
              ) : null}

              <div className="my-1 border-t border-slate-200" />

              {legalLinks.map((link) => (
                <a key={link.href} href={link.href} className="rounded-2xl bg-white px-4 py-3 text-slate-700">
                  {link.label}
                </a>
              ))}
            </div>
          ) : null}
        </header>

        {children}

        <footer
          data-kosmos-mobile-legal-footer
          className="mt-5 rounded-[1.5rem] bg-white/90 p-4 text-center text-[11px] font-bold leading-5 text-slate-400 shadow-xl"
        >
          <p className="mb-2 text-[11px] font-semibold tracking-wide text-slate-400">
            KOSMOS SMART PARKING {APP_VERSION}
          </p>

          <div
            className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-slate-500"
            data-kosmos-legal-links
          >
            {legalLinks.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-slate-900">
                {link.label}
              </a>
            ))}
          </div>

          <div
            className="mt-3 space-y-1 text-xs leading-5 text-slate-500"
            data-kosmos-company-info
          >
            <p>© 2026 KOSMOS Co., Ltd. All rights reserved.</p>
            <p>코스모스 주식회사 · 주소: 전라남도 화순군 화순읍 홍문길 4</p>
            <p>사업자등록번호: 507-81-17904 · 대표자: 윤도영</p>
            <p>대표번호: 010-2983-1136 · 이메일: admin@kosmos.io.kr</p>
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
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={itemClass(isActive(pathname, item.href))}
            >
              <span className="text-sm leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      </nav>
    </main>
  );
}
