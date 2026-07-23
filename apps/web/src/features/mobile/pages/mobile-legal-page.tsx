'use client';

import { MobileAppShell } from '@/components/mobile/mobile-app-shell';

type LegalKind = 'terms' | 'privacy' | 'location';

type Section = {
  title: string;
  paragraphs?: string[];
  items?: string[];
};

type LegalDocument = {
  title: string;
  subtitle: string;
  effectiveDate: string;
  sections: Section[];
};

const COMPANY = {
  service: '코스모스 스마트 주차 서비스',
  company: '코스모스 주식회사',
  representative: '윤도영',
  businessNumber: '507-81-17904',
  address: '전라남도 화순군 화순읍 홍문길 4',
  phone: '010-2983-1136',
  email: 'admin@kosmos.io.kr',
};

const DOCUMENTS: Record<LegalKind, LegalDocument> = {
  terms: {
    title: '이용약관',
    subtitle: '코스모스 스마트 주차 서비스 이용 기준입니다.',
    effectiveDate: '2026년 7월 21일',
    sections: [
      {
        title: '제1조 목적',
        paragraphs: [
          `본 약관은 ${COMPANY.company}(이하 “회사”)가 제공하는 “${COMPANY.service}”(이하 “서비스”)의 이용과 관련하여 회사와 이용자 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.`,
        ],
      },
      {
        title: '제2조 약관의 효력 및 변경',
        paragraphs: [
          '본 약관은 서비스 화면에 게시하거나 기타 방법으로 공지함으로써 효력이 발생합니다.',
          '회사는 관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며, 변경 내용과 시행일을 서비스 화면을 통해 안내합니다.',
          '이용자가 변경된 약관에 동의하지 않을 경우 서비스 이용을 중단하고 회원 탈퇴를 요청할 수 있습니다.',
        ],
      },
      {
        title: '제3조 용어의 정의',
        items: [
          '“서비스”란 주차장 정보 제공, 센서 기반 차량 입·출차 관리, 주차 등록, 주차 요금 산정·결제 및 관련 기능을 의미합니다.',
          '“회원”이란 이용계약을 체결하고 회원 계정을 부여받은 이용자를 의미합니다.',
          '“방문객”이란 회원가입 없이 휴대전화번호와 PIN 등으로 서비스를 이용하는 자를 의미합니다.',
          '“주차장 운영자”란 회사와 계약하거나 권한을 부여받아 주차장을 관리하는 자를 의미합니다.',
          '“콘텐츠”란 주차장, 주차면, 지도, 센서, 요금, 할인권 및 결제와 관련하여 서비스에서 제공되는 정보를 의미합니다.',
        ],
      },
      {
        title: '제4조 이용계약의 성립',
        paragraphs: [
          '이용계약은 이용자가 약관과 개인정보 처리에 동의하고 회원가입 또는 방문객 등록을 신청한 후 회사가 이를 승인함으로써 성립합니다.',
        ],
        items: [
          '허위 정보를 기재하거나 타인의 정보를 도용한 경우 신청을 거부하거나 이용을 제한할 수 있습니다.',
          '서비스 제공에 기술적 또는 운영상 문제가 있는 경우 승인을 유보할 수 있습니다.',
        ],
      },
      {
        title: '제5조 서비스의 내용',
        items: [
          '주차장 위치, 운영시간, 요금 및 이용 가능 주차면 정보 제공',
          '센서 기반 차량 입·출차 및 주차 상태 관리',
          '회원 또는 방문객의 차량 및 주차 등록',
          '주차 요금 산정, 할인 적용, 청구서 발행 및 결제',
          '입점업체 할인권 구매·증정·사용',
          '주차장 운영자용 관리 기능',
        ],
      },
      {
        title: '제6조 서비스의 변경 및 중단',
        paragraphs: [
          '회사는 서비스 개선, 시스템 점검, 설비 장애, 통신 장애, 천재지변 등 합리적인 사유가 있는 경우 서비스의 일부 또는 전부를 변경하거나 일시 중단할 수 있습니다.',
          '중요한 변경 또는 계획된 중단은 가능한 범위에서 사전에 안내합니다.',
        ],
      },
      {
        title: '제7조 이용자의 의무',
        items: [
          '본인과 실제 차량의 정확한 정보를 등록해야 합니다.',
          '다른 사람의 계정, 휴대전화번호, 차량번호 또는 할인권을 부정하게 사용해서는 안 됩니다.',
          '주차 센서, 게이트웨이, 전광판 및 주차장 시설을 훼손하거나 서비스 운영을 방해해서는 안 됩니다.',
          '관련 법령, 주차장 운영 규정 및 서비스 안내를 준수해야 합니다.',
        ],
      },
      {
        title: '제8조 주차 요금 및 결제',
        paragraphs: [
          '주차 요금과 할인 정책은 각 주차장 운영 정책에 따라 정해지며 서비스 화면에 표시됩니다.',
          '이용자는 회사가 제공하거나 연계하는 결제수단을 이용하여 주차 요금을 결제할 수 있습니다.',
          '결제 오류, 중복 결제 또는 취소가 필요한 경우 회사와 결제대행사의 확인 절차에 따라 처리합니다.',
          '결제 후 출차 유예시간이 적용될 수 있으며 유예시간을 초과하면 추가 요금이 발생할 수 있습니다.',
        ],
      },
      {
        title: '제9조 할인 및 할인권',
        paragraphs: [
          '자동 할인과 입점업체 할인권은 적용 조건, 중복 가능 여부, 유효기간 및 사용 상태에 따라 적용됩니다.',
          '일회용 할인권은 한 주차 세션에 한 번만 사용할 수 있으며 결제 완료 후에는 다른 세션에 재사용할 수 없습니다.',
          '부정한 방법으로 취득하거나 사용한 할인은 취소될 수 있습니다.',
        ],
      },
      {
        title: '제10조 계약 해지 및 이용 제한',
        paragraphs: [
          '회원은 서비스에서 제공하는 절차에 따라 회원 탈퇴를 요청할 수 있습니다.',
          '회사는 이용자가 법령 또는 본 약관을 위반하거나 서비스 운영을 방해한 경우 사전 통지 후 이용을 제한할 수 있습니다. 긴급하거나 중대한 위반의 경우 우선 제한 후 통지할 수 있습니다.',
        ],
      },
      {
        title: '제11조 책임 제한',
        paragraphs: [
          '회사는 고의 또는 중대한 과실이 없는 한 천재지변, 통신 장애, 금융기관 또는 결제대행사의 장애, 이용자의 귀책사유, 주차장 운영자가 제공한 잘못된 정보로 발생한 손해에 대해 책임을 지지 않습니다.',
          '센서 데이터는 현장 환경과 장치 상태에 따라 지연 또는 오차가 발생할 수 있으며 이용자는 현장 표지와 운영자의 안내를 함께 확인해야 합니다.',
        ],
      },
      {
        title: '제12조 준거법 및 분쟁 해결',
        paragraphs: [
          '본 약관은 대한민국 법령을 준거로 합니다.',
          '서비스 이용과 관련한 분쟁은 당사자 간 협의를 우선하며 해결되지 않는 경우 관계 법령에 따른 관할 법원에서 처리합니다.',
        ],
      },
    ],
  },
  privacy: {
    title: '개인정보처리방침',
    subtitle: '회원·방문객·차량·주차 및 결제 정보 처리 기준입니다.',
    effectiveDate: '2026년 7월 21일',
    sections: [
      {
        title: '제1조 총칙',
        paragraphs: [
          `${COMPANY.company}는 개인정보 보호법 등 관련 법령을 준수하며, ${COMPANY.service} 이용자의 개인정보를 안전하게 처리합니다.`,
        ],
      },
      {
        title: '제2조 처리하는 개인정보 항목',
        items: [
          '회원: 이름, 휴대전화번호, 로그인 식별정보, 암호화된 비밀번호, 차량번호, 차량 종류 및 동력 유형',
          '방문객: 휴대전화번호, 암호화된 PIN, 차량번호 및 방문 등록 정보',
          '주차 이용: 주차장·주차면, 입차·출차 시각, 센서 이벤트, 주차 세션, 할인 적용 및 요금 정보',
          '결제: 청구서, 결제금액, 결제수단 구분, 결제대행사 거래 식별정보 및 결제 상태',
          '서비스 이용 과정: 접속 IP, 브라우저·기기정보, 접속 기록, 오류 및 보안 로그',
          '선택 항목: 위치정보, 차량 사진, 문의 내용 및 이용자가 직접 제공한 자료',
        ],
      },
      {
        title: '제3조 개인정보의 처리 목적',
        items: [
          '회원가입, 본인 확인, 로그인 및 비밀번호 재설정',
          '차량과 주차 세션의 연결 및 센서 기반 입·출차 처리',
          '주차장 및 이용 가능 주차면 정보 제공',
          '주차 요금 산정, 할인·할인권 적용, 청구 및 결제',
          '주차 이용 이력과 영수증 제공',
          '민원, 오류, 부정 이용 및 보안 사고 대응',
          '서비스 품질 개선, 통계 및 법적 의무 이행',
        ],
      },
      {
        title: '제4조 보유 및 이용기간',
        paragraphs: [
          '개인정보는 원칙적으로 처리 목적이 달성되거나 회원 탈퇴 시 지체 없이 파기합니다.',
          '전자상거래 등에서의 소비자보호에 관한 법률, 전자금융거래법, 통신비밀보호법 등 관계 법령에 따라 보존이 필요한 정보는 해당 법령이 정한 기간 동안 별도로 보관합니다.',
          '분쟁, 미납 요금, 부정 이용 또는 법적 절차가 진행 중인 경우 필요한 범위와 기간 동안 보관할 수 있습니다.',
        ],
      },
      {
        title: '제5조 개인정보의 제3자 제공',
        paragraphs: [
          '회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 다만 법령에 근거가 있거나 수사기관 등 적법한 권한을 가진 기관의 요청이 있는 경우는 예외로 합니다.',
          '주차장 운영에 필요한 경우 해당 주차장 운영자에게 차량번호, 주차 세션 및 요금 처리에 필요한 최소한의 정보가 제공될 수 있습니다.',
        ],
      },
      {
        title: '제6조 개인정보 처리의 위탁',
        paragraphs: [
          '회사는 결제 처리, 문자 인증, 클라우드 인프라, 고객지원 등 서비스 운영에 필요한 업무를 외부 전문업체에 위탁할 수 있습니다.',
          '위탁 시 개인정보 보호 의무, 목적 외 처리 금지, 안전성 확보 및 재위탁 제한에 관한 사항을 계약에 반영하고 관리·감독합니다.',
        ],
      },
      {
        title: '제7조 이용자의 권리',
        items: [
          '개인정보 열람, 정정, 삭제 및 처리정지 요청',
          '회원 탈퇴와 동의 철회',
          '개인정보 처리 내역과 제공·위탁 현황에 대한 문의',
          '법정대리인을 통한 권리 행사',
        ],
      },
      {
        title: '제8조 쿠키 및 자동 수집 정보',
        paragraphs: [
          '회사는 로그인 유지, 보안, 화면 설정 및 서비스 개선을 위해 쿠키 또는 브라우저 저장소를 사용할 수 있습니다.',
          '이용자는 브라우저 설정에서 쿠키 저장을 제한할 수 있으나 일부 기능 이용이 제한될 수 있습니다.',
        ],
      },
      {
        title: '제9조 개인정보의 안전성 확보 조치',
        items: [
          '비밀번호와 PIN의 단방향 암호화 저장',
          '전송구간 암호화와 접근권한 통제',
          '관리자 및 운영자 권한의 최소 부여와 접근 기록 관리',
          '보안 프로그램 운영, 취약점 점검 및 로그 모니터링',
          '개인정보 취급자 교육과 물리적 접근 통제',
          '센서·주차·결제 데이터에 대한 무결성 및 백업 관리',
        ],
      },
      {
        title: '제10조 개인정보 보호책임자',
        items: [
          `책임자: ${COMPANY.representative}`,
          `연락처: ${COMPANY.phone}`,
          `이메일: ${COMPANY.email}`,
        ],
      },
      {
        title: '제11조 고지의 의무',
        paragraphs: [
          '개인정보처리방침이 변경되는 경우 시행일과 주요 변경 내용을 서비스 화면을 통해 안내합니다.',
        ],
      },
    ],
  },
  location: {
    title: '위치기반서비스 이용약관',
    subtitle: '주변 주차장 검색과 위치 기반 안내 기준입니다.',
    effectiveDate: '2026년 7월 21일',
    sections: [
      {
        title: '제1조 목적',
        paragraphs: [
          `본 약관은 ${COMPANY.company}가 제공하는 위치기반서비스 이용과 관련하여 회사와 이용자 간의 권리·의무 및 책임사항을 규정합니다.`,
        ],
      },
      {
        title: '제2조 위치정보의 이용 목적',
        items: [
          '이용자 주변의 주차장 검색 및 거리 안내',
          '선택한 주차장의 위치와 접근 경로 제공',
          '서비스 품질 개선을 위한 비식별 통계 분석',
        ],
      },
      {
        title: '제3조 수집 및 이용 방식',
        paragraphs: [
          '위치정보는 이용자가 브라우저 또는 단말기에서 위치정보 제공에 동의한 경우에만 사용합니다.',
          '회사는 서비스 제공에 필요한 최소한의 범위에서 위치정보를 이용하며, 별도 고지 없이 개인위치정보를 제3자에게 제공하지 않습니다.',
        ],
      },
      {
        title: '제4조 이용자의 권리',
        items: [
          '위치정보 이용 동의의 전부 또는 일부 철회',
          '위치정보 이용·제공 사실 확인 및 열람 요청',
          '브라우저 또는 단말기 설정을 통한 위치 권한 차단',
        ],
      },
      {
        title: '제5조 보호조치 및 문의',
        paragraphs: [
          '회사는 위치정보 보호를 위해 접근권한 통제, 전송구간 보호, 이용 기록 관리 등 기술적·관리적 조치를 시행합니다.',
          `위치정보 관련 문의는 ${COMPANY.email} 또는 ${COMPANY.phone}으로 접수할 수 있습니다.`,
        ],
      },
    ],
  },
};

export function MobileLegalPage({ kind }: { kind: LegalKind }) {
  const document = DOCUMENTS[kind];

  return (
    <MobileAppShell title={document.title} subtitle={document.subtitle}>
      <article className="space-y-4">
        <section className="rounded-[2rem] bg-white p-5 shadow-xl ring-1 ring-slate-100">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
            {COMPANY.service}
          </p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">{document.title}</h1>
          <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
            {document.subtitle}
          </p>
          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-bold leading-5 text-slate-500">
            시행일: {document.effectiveDate}
            <br />
            {COMPANY.company} · 대표 {COMPANY.representative}
          </div>
        </section>

        {document.sections.map((section) => (
          <section
            key={section.title}
            className="rounded-[2rem] bg-white p-5 shadow-xl ring-1 ring-slate-100"
          >
            <h2 className="text-base font-black text-slate-950">{section.title}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p
                key={paragraph}
                className="mt-3 whitespace-pre-line text-sm font-medium leading-7 text-slate-700"
              >
                {paragraph}
              </p>
            ))}
            {section.items ? (
              <ul className="mt-3 space-y-2 text-sm font-medium leading-6 text-slate-700">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        <section className="rounded-[2rem] bg-slate-900 p-5 text-sm font-bold leading-6 text-slate-300 shadow-xl">
          <p className="font-black text-white">{COMPANY.company}</p>
          <p className="mt-2">
            대표: {COMPANY.representative} · 사업자등록번호: {COMPANY.businessNumber}
            <br />
            주소: {COMPANY.address}
            <br />
            전화: {COMPANY.phone} · 이메일: {COMPANY.email}
          </p>
        </section>
      </article>
    </MobileAppShell>
  );
}
