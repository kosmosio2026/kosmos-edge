import { KOSMOS_COMPANY } from '@/lib/kosmos-company';

const sections = [
  ['제1조 총칙', '회사는 이용자의 개인정보를 중요하게 생각하며, 개인정보보호법 등 관련 법령을 준수합니다.'],
  ['제2조 수집하는 개인정보 항목', '회사는 이름, 연락처, 이메일, 차량번호, 결제정보, 서비스 이용 기록을 필수정보로 수집할 수 있습니다. 또한 위치정보, 주차 선호 정보, 접속 IP, 쿠키, 기기정보, 센서 기반 입·출차 기록 및 로그 기록을 수집할 수 있습니다.'],
  ['제3조 개인정보의 수집 및 이용 목적', '회사는 회원가입 및 본인 확인, 주차장 정보 제공, 센서 기반 입·출차 자동 인식, 주차 요금 산정 및 결제, 고객 문의 대응, 서비스 개선 및 통계 분석, 법령 준수 및 의무 이행을 위해 개인정보를 이용합니다.'],
  ['제4조 개인정보의 보유 및 이용기간', '회사는 개인정보를 수집 목적 달성 시까지 보유하며, 관련 법령에 따라 일정 기간 보관할 수 있습니다.'],
  ['제5조 개인정보의 제3자 제공', '회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 단, 법령에 따른 요청이 있는 경우 예외로 합니다.'],
  ['제6조 개인정보 처리의 위탁', '회사는 서비스 운영을 위해 일부 업무를 외부 업체에 위탁할 수 있으며, 위탁 시 개인정보 보호를 위한 계약을 체결합니다.'],
  ['제7조 이용자의 권리', '이용자는 자신의 개인정보에 대해 열람·정정·삭제·처리정지를 요구할 수 있습니다.'],
  ['제8조 쿠키의 운영', '회사는 이용자 맞춤형 서비스를 제공하기 위해 쿠키를 사용할 수 있으며, 이용자는 브라우저 설정을 통해 쿠키 사용을 거부할 수 있습니다.'],
  ['제9조 개인정보의 안전성 확보 조치', '회사는 접근권한 관리, 암호화, 보안 프로그램 설치, 정기적인 점검, 물리적 접근 통제, 센서 데이터 보호 조치를 시행합니다.'],
  ['제10조 개인정보 보호책임자', `책임자: ${KOSMOS_COMPANY.representative}\n연락처: ${KOSMOS_COMPANY.phone}\n이메일: ${KOSMOS_COMPANY.email}`],
  ['제11조 고지의 의무', '개인정보처리방침 변경 시 서비스 공지사항을 통해 안내합니다.'],
];

export default function PrivacyPage() {
  return <LegalPage title="개인정보처리방침" sections={sections} />;
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
