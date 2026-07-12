import { KOSMOS_COMPANY } from '@/lib/kosmos-company';

const sections = [
  ['제1조 목적', '본 약관은 회사가 제공하는 위치기반서비스 이용과 관련하여 회사와 이용자 간의 권리·의무를 규정합니다.'],
  ['제2조 위치정보의 수집 및 이용', '회사는 주변 주차장 정보 제공, 주차장 접근 시 자동 입·출차 인식, 위치 기반 요금 산정, 맞춤형 주차 추천 서비스 제공을 위해 개인위치정보를 최소한의 범위에서 수집·이용할 수 있습니다.'],
  ['제3조 개인위치정보의 제공 및 보유', '회사는 이용자의 동의 없이 개인위치정보를 제3자에게 제공하지 않습니다. 회사는 개인위치정보 이용·제공 사실을 기록·보관하며, 법령에 따라 일정 기간 보유합니다.'],
  ['제4조 이용자의 권리', '이용자는 개인위치정보 이용·제공 동의 철회, 열람·정정·삭제 요청, 위치정보 이용·제공 사실 확인 요청 권리를 가집니다.'],
  ['제5조 법정대리인의 권리', '회사는 만 14세 미만 이용자의 개인위치정보를 수집·이용·제공하기 위해 법정대리인의 동의를 받습니다.'],
  ['제6조 회사의 의무', '회사는 위치정보 관리책임자를 지정하고 위치정보 보호를 위한 기술적·관리적 조치를 시행합니다.'],
  ['제7조 분쟁 해결', '위치정보 관련 분쟁은 위치정보법 및 관련 법령에 따라 처리하며, 회사 소재지 관할 법원을 제1심 법원으로 합니다.'],
];

export default function LocationTermsPage() {
  return <LegalPage title="위치정보 이용약관" sections={sections} />;
}

function LegalPage({ title, sections }: { title: string; sections: string[][] }) {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <article className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow">
        <p className="text-sm font-bold text-blue-600">{KOSMOS_COMPANY.serviceName}</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">{title}</h1>
        <CompanyInfo />
        <div className="mt-8 space-y-6">
          {sections.map(([heading, body]) => (
            <section key={heading}>
              <h2 className="text-lg font-black text-slate-900">{heading}</h2>
              <p className="mt-2 whitespace-pre-line leading-7 text-slate-700">{body}</p>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}

function CompanyInfo() {
  return (
    <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
      <p>{KOSMOS_COMPANY.copyright}</p>
      <p>{KOSMOS_COMPANY.companyNameKo} · 대표번호: {KOSMOS_COMPANY.phone} · 이메일: {KOSMOS_COMPANY.email}</p>
      <p>주소: {KOSMOS_COMPANY.address}</p>
      <p>사업자등록번호: {KOSMOS_COMPANY.businessRegistrationNo}</p>
      <p>대표자: {KOSMOS_COMPANY.representative}</p>
    </div>
  );
}
