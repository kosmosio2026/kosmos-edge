import { KOSMOS_COMPANY } from '@/lib/kosmos-company';

const sections = [
  ['제1조 목적', '본 약관은 코스모스 주식회사가 제공하는 전자지급결제대행 서비스 및 결제 관련 전자금융거래 서비스 이용과 관련하여 회사와 이용자 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.'],
  ['제2조 정의', '“전자금융거래”란 회사가 제공하는 전자적 장치를 이용한 금융거래를 의미합니다. “전자지급결제대행 서비스”란 이용자가 주차 요금을 결제할 수 있도록 회사가 제공하는 결제 중개 서비스를 의미합니다.'],
  ['제3조 약관의 효력 및 변경', '본 약관은 서비스 화면에 게시하거나 기타 방법으로 공지함으로써 효력이 발생합니다. 회사는 관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있습니다.'],
  ['제4조 전자금융거래의 종류', '회사는 주차 요금 결제를 위한 전자지급결제대행 서비스, 자동결제 기능, 결제 내역 조회 서비스, 기타 전자적 결제 관련 서비스를 제공합니다.'],
  ['제5조 전자지급결제대행 서비스의 제공', '회사는 이용자가 주차 요금을 결제할 수 있도록 결제대행 서비스를 제공합니다. 결제 방식은 신용카드, 체크카드, 간편결제, 계좌이체 등 회사가 지원하는 방식으로 제한됩니다.'],
  ['제6조 이용자의 의무', '이용자는 접근매체를 제3자에게 제공하거나 공유해서는 안 되며, 결제 과정에서 허위 정보를 입력하거나 부정 결제 또는 불법 행위를 해서는 안 됩니다.'],
  ['제7조 회사의 의무', '회사는 전자금융거래의 안정성을 확보하기 위해 기술적·관리적 보호조치를 시행하고 결제 오류 발생 시 관련 법령에 따라 신속히 처리합니다.'],
  ['제8조 접근매체의 관리', '이용자는 접근매체를 직접 관리해야 하며, 분실·도난 시 즉시 회사에 신고해야 합니다.'],
  ['제9조 결제의 승인 및 취소', '이용자가 결제를 요청하면 회사는 결제대행업체를 통해 승인 절차를 진행합니다. 결제 취소는 관련 법령 및 결제대행업체의 정책에 따라 처리됩니다.'],
  ['제10조 거래내역의 확인', '이용자는 서비스 내 결제 내역 조회 기능을 통해 거래내역을 확인할 수 있으며, 오류가 있을 경우 회사에 정정을 요청할 수 있습니다.'],
  ['제11조 전자금융거래의 안전성 확보', '회사는 결제정보 암호화, 보안 서버 운영, 접근권한 통제, 이상 거래 탐지, 정기 보안 점검 등의 조치를 시행합니다.'],
  ['제12조 전자금융거래의 장애 및 처리', '전자금융거래에 장애가 발생한 경우 회사는 즉시 복구 조치를 시행하며, 결제가 정상적으로 이루어지지 않은 경우 관련 법령에 따라 처리합니다.'],
  ['제13조 책임 제한', '회사는 이용자의 귀책으로 인한 결제 오류, 결제대행업체 또는 금융기관의 시스템 장애, 천재지변 등 불가항력, 주차장 운영자가 제공한 요금 정보의 오류에 대해 고의 또는 중대한 과실이 없는 한 책임을 지지 않습니다.'],
  ['제14조 분쟁 해결', '전자금융거래 관련 분쟁은 전자금융거래법 및 관련 법령에 따라 처리합니다. 이용자는 금융감독원 분쟁조정위원회에 분쟁조정을 신청할 수 있습니다.'],
];

export default function ElectronicFinanceTermsPage() {
  return <LegalPage title="전자금융거래 이용약관" sections={sections} />;
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
