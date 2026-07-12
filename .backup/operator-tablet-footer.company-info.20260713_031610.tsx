import Link from 'next/link';

export function OperatorTabletFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white px-6 py-5 text-xs font-bold text-slate-500">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="font-black text-slate-800">
            © 2026 Kosmos Parking. All rights reserved.
          </div>
          <div className="mt-1">
            코스모스 주식회사 | 전라남도 화순군 화순읍 홍문길 4 | 010-2983-1136 | admin@kosmos.io.kr
          </div>
        </div>

        <nav className="flex flex-wrap gap-x-4 gap-y-2">
          <Link href="/mobile/terms" className="hover:text-blue-600 hover:underline">
            이용약관
          </Link>
          <Link href="/mobile/location-terms" className="hover:text-blue-600 hover:underline">
            위치정보 이용약관
          </Link>
          <Link href="/mobile/privacy" className="hover:text-blue-600 hover:underline">
            개인정보처리방침
          </Link>
          <a href="tel:010-2983-1136" className="hover:text-blue-600 hover:underline">
            연락처
          </a>
          <a href="mailto:admin@kosmos.io.kr" className="hover:text-blue-600 hover:underline">
            이메일
          </a>
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
