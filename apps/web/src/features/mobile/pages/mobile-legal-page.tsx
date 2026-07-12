'use client';

import { MobileAppShell } from '@/components/mobile/mobile-app-shell';

type LegalType = 'terms' | 'privacy' | 'location';

type Props = {
  type: LegalType;
};

const LEGAL_CONTENT: Record<
  LegalType,
  {
    title: string;
    subtitle: string;
    heading: string;
    body: string[];
  }
> = {
  terms: {
    title: '이용약관',
    subtitle: 'Kosmos Parking 모바일 서비스 이용 조건입니다.',
    heading: '서비스 이용약관',
    body: [
      '본 약관은 Kosmos Parking 모바일 주차 서비스의 이용 조건과 절차, 이용자와 회사의 권리·의무 및 책임사항을 규정합니다.',
      '이용자는 입차 감지 후 주차 등록이 필요한 주차면에 한해 차량번호, 연락처, 회원 차량 정보 등을 입력하여 주차 등록을 진행할 수 있습니다.',
      '주차 등록, 요금 확인, 결제 및 영수증 확인 기능은 서비스 정책과 주차장 운영 조건에 따라 제공됩니다.',
      '정식 서비스 전에는 본 약관의 세부 내용이 변경될 수 있으며, 실제 배포 전 법무 검토가 필요합니다.',
    ],
  },
  privacy: {
    title: '개인정보처리방침',
    subtitle: '차량번호, 연락처 등 개인정보 처리 기준입니다.',
    heading: '개인정보처리방침',
    body: [
      '회사는 모바일 주차 등록, 현재 주차 확인, 결제 및 영수증 제공을 위해 필요한 최소한의 개인정보를 처리합니다.',
      '처리될 수 있는 정보에는 차량번호, 휴대폰 번호, 회원 계정 정보, 주차장 이용 이력, 결제 관련 정보가 포함될 수 있습니다.',
      '수집된 정보는 주차 서비스 제공, 부정 이용 방지, 요금 정산, 고객 문의 대응 목적 범위 내에서 이용됩니다.',
      '정식 서비스 전에는 개인정보 항목, 보관 기간, 제3자 제공 및 위탁 처리 내용을 실제 운영 정책에 맞게 보완해야 합니다.',
    ],
  },
  location: {
    title: '위치기반서비스 이용약관',
    subtitle: '위치 권한 및 주차장 지도 이용 기준입니다.',
    heading: '위치기반서비스 이용약관',
    body: [
      '모바일 앱은 사용자의 현재 위치를 바탕으로 가까운 주차장 또는 주차장 지도 화면을 제공할 수 있습니다.',
      '위치 정보는 주차장 탐색, 주차면 상태 확인, QR 없이 주차 등록을 시작하기 위한 보조 목적으로 사용됩니다.',
      '사용자는 브라우저 또는 앱 설정에서 언제든 위치 권한을 거부하거나 철회할 수 있습니다.',
      '정식 서비스 전에는 위치정보법 및 관련 규정에 맞춰 위치정보 이용 목적, 보관 여부, 파기 절차를 구체화해야 합니다.',
    ],
  },
};

export default function MobileLegalPage({ type }: Props) {
  const content = LEGAL_CONTENT[type];

  return (
    <MobileAppShell title={content.title} subtitle={content.subtitle}>
      <section className="rounded-[2rem] bg-white p-5 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">
          LEGAL
        </p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">
          {content.heading}
        </h1>

        <div className="mt-5 space-y-4 text-sm font-bold leading-6 text-slate-600">
          {content.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        <div className="mt-6 rounded-3xl bg-amber-50 p-4 text-xs font-bold leading-5 text-amber-700">
          현재 문구는 MVP용 샘플입니다. 실제 상용 배포 전에는 회사 정보,
          개인정보 보관 기간, 제3자 제공, 결제 대행, 위치정보 처리 기준을
          법무 검토 후 확정해야 합니다.
        </div>
      </section>
    </MobileAppShell>
  );
}
