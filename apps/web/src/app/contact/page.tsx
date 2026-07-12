import { KOSMOS_COMPANY, KOSMOS_LEGAL_LINKS } from '@/lib/kosmos-company';

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow">
        <p className="text-sm font-bold text-blue-600">
          {KOSMOS_COMPANY.serviceName}
        </p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">
          회사 정보
        </h1>

        <div className="mt-8 grid gap-4 text-sm text-slate-700 md:grid-cols-2">
          <Info label="회사명" value={KOSMOS_COMPANY.companyNameKo} />
          <Info label="대표자" value={KOSMOS_COMPANY.representative} />
          <Info label="대표번호" value={KOSMOS_COMPANY.phone} />
          <Info label="이메일" value={KOSMOS_COMPANY.email} />
          <Info label="사업자등록번호" value={KOSMOS_COMPANY.businessRegistrationNo} />
          <Info label="주소" value={KOSMOS_COMPANY.address} wide />
        </div>

        <div className="mt-8 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          <p>{KOSMOS_COMPANY.copyright}</p>
          <p>
            {KOSMOS_COMPANY.companyNameKo} · 대표번호: {KOSMOS_COMPANY.phone} · 이메일: {KOSMOS_COMPANY.email}
          </p>
          <p>주소: {KOSMOS_COMPANY.address}</p>
          <p>
            사업자등록번호: {KOSMOS_COMPANY.businessRegistrationNo} · 대표자: {KOSMOS_COMPANY.representative}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-blue-700">
          {KOSMOS_LEGAL_LINKS.map((item) => (
            <a key={item.href} href={item.href} className="hover:underline">
              {item.label}
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}

function Info({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={`rounded-2xl border border-slate-100 bg-slate-50 p-4 ${wide ? 'md:col-span-2' : ''}`}>
      <p className="text-xs font-bold text-slate-400">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}
