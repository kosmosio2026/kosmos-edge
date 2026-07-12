import Link from 'next/link';

const footerLinks = [
  { label: '이용약관', href: '/terms' },
  { label: '위치정보이용약관', href: '/location-terms' },
  { label: '개인정보보호정책', href: '/privacy' },
  { label: '연락처', href: '/contact' },
  { label: '회사 소개', href: '/about' },
];

export function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-10 border-t border-slate-200 bg-white px-6 py-6 text-xs text-slate-500">
      <div className="mx-auto flex w-full max-w-none flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="font-semibold text-slate-700">
            © {year} KOSMOS Co., Ltd. All rights reserved.
          </div>
          <div>
            코스모스 주식회사 · 대표번호: 000-0000-0000 · 이메일: contact@kosmos.local
          </div>
          <div>
            주소: 대한민국, 사업장 주소 입력 예정 · 사업자등록번호: 000-00-00000
          </div>
          <div>
            
          </div>
        </div>

        <nav className="flex flex-wrap gap-x-4 gap-y-2 md:justify-end">
          {footerLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-medium text-slate-600 hover:text-slate-950"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500" data-kosmos-legal-links>
  <a href="/terms" className="hover:text-slate-900">이용약관</a>
  <a href="/privacy" className="hover:text-slate-900">개인정보처리방침</a>
  <a href="/location-terms" className="hover:text-slate-900">위치정보 이용약관</a>
  <a href="/electronic-finance-terms" className="hover:text-slate-900">전자금융거래 이용약관</a>
</div>
<div className="mt-3 space-y-1 text-xs leading-5 text-slate-500" data-kosmos-company-info>
  <p>© 2026 KOSMOS Co., Ltd. All rights reserved.</p>
  <p>코스모스 주식회사 · 대표번호: 010-2983-1136 · 이메일: admin@kosmos.io.kr</p>
  <p>주소: 전라남도 화순군 화순읍 홍문길 4</p>
  <p>사업자등록번호: 507-81-17904 · 대표자: 윤도영</p>
</div>
</footer>
  );
}
