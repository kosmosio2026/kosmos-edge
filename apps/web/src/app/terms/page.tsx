import { KOSMOS_COMPANY } from '@/lib/kosmos-company';

const sections = [
  ['제1조 목적', '본 약관은 코스모스 주식회사(이하 “회사”)가 제공하는 “코스모스 스마트 주차 서비스”(이하 “서비스”)의 이용과 관련하여 회사와 이용자 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.'],
  ['제2조 약관의 효력 및 변경', '본 약관은 서비스 화면에 게시하거나 기타 방법으로 공지함으로써 효력이 발생합니다. 회사는 관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며, 변경된 약관은 공지 후 효력이 발생합니다.'],
  ['제3조 용어의 정의', '“서비스”란 회사가 제공하는 주차장 정보 제공 서비스, 센서 기반 입·출차 관리 서비스, 주차 요금 정산 및 결제 서비스 등 주차 관련 기능 일체를 의미합니다. “회원”은 회사와 이용계약을 체결하고 계정을 부여받은 자를, “비회원”은 회원가입 없이 서비스를 이용하는 자를 의미합니다.'],
  ['제4조 이용계약의 성립', '이용계약은 이용자가 약관에 동의하고 회원가입을 신청한 후 회사가 이를 승인함으로써 성립합니다. 회사는 허위 정보 기재, 타인 명의 도용, 기술적 문제 또는 기타 부적절한 사유가 있는 경우 이용 신청을 거부하거나 유보할 수 있습니다.'],
  ['제5조 서비스의 내용', '회사는 주차장 위치·요금·운영시간 등 정보 제공, 센서 기반 차량 입·출차 자동 인식, 주차 요금 자동 산정 및 결제, 주차장 운영자용 관리 시스템, 기타 회사가 정하는 주차 관련 서비스를 제공합니다.'],
  ['제6조 서비스의 중단', '회사는 시스템 점검, 유지보수, 천재지변, 정전, 통신 장애 또는 기타 필요한 경우 서비스 제공을 일시 중단할 수 있습니다.'],
  ['제7조 이용자의 의무', '이용자는 타인의 정보 도용, 불법 정보 게시, 지식재산권 침해, 센서 장비 또는 주차장 시설 훼손, 서비스 운영 방해, 법령 또는 공공질서·미풍양속에 반하는 행위를 해서는 안 됩니다.'],
  ['제8조 회사의 의무', '회사는 관련 법령을 준수하며 안정적인 서비스 제공을 위해 최선을 다합니다. 또한 개인정보보호법 등 관련 법령에 따라 이용자의 개인정보를 보호합니다.'],
  ['제9조 요금 및 결제', '주차 요금은 주차장 운영자가 정하며, 회사는 해당 정보를 서비스에 제공합니다. 이용자는 회사가 제공하는 결제 시스템을 통해 주차 요금을 결제할 수 있습니다.'],
  ['제10조 계약 해지 및 이용 제한', '이용자는 언제든지 회원 탈퇴를 요청할 수 있으며, 회사는 이용자가 약관을 위반한 경우 서비스 이용을 제한하거나 계약을 해지할 수 있습니다.'],
  ['제11조 책임 제한', '회사는 이용자의 귀책, 주차장 운영자가 제공한 정보의 오류, 센서 오작동 등 외부 요인으로 인한 데이터 오류, 불가항력으로 인한 손해에 대해 고의 또는 중대한 과실이 없는 한 책임을 지지 않습니다.'],
  ['제12조 준거법 및 분쟁 해결', '본 약관은 대한민국 법령을 준거로 하며, 분쟁 발생 시 회사 소재지 관할 법원을 제1심 법원으로 합니다.'],
];

export default function TermsPage() {
  return <LegalPage title="이용약관" sections={sections} />;
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
