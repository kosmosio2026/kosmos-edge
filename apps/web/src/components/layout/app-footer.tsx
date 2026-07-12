import { KOSMOS_COMPANY, KOSMOS_LEGAL_LINKS } from '@/lib/kosmos-company';

export function AppFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white px-6 py-6 text-xs text-slate-500">
      <div className="mx-auto max-w-7xl space-y-2">
        <div className="flex flex-wrap gap-x-4 gap-y-2 font-semibold">
          {KOSMOS_LEGAL_LINKS.map((item) => (
            <a key={item.href} href={item.href} className="hover:text-slate-900">
              {item.label}
            </a>
          ))}
        </div>

        <div className="space-y-1 leading-5">
          <p>{KOSMOS_COMPANY.copyright}</p>
          <p>
            {KOSMOS_COMPANY.companyNameKo} · 대표번호: {KOSMOS_COMPANY.phone} · 이메일: {KOSMOS_COMPANY.email}
          </p>
          <p>주소: {KOSMOS_COMPANY.address}</p>
          <p>
            사업자등록번호: {KOSMOS_COMPANY.businessRegistrationNo} · 대표자: {KOSMOS_COMPANY.representative}
          </p>
        </div>
      </div>
    </footer>
  );
}

export default AppFooter;
