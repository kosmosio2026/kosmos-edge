export default function Page() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm">
        <p className="text-sm font-bold text-blue-600">KOSMOS Parking</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">회사 소개</h1>

        <div className="mt-8 space-y-4 text-sm leading-7 text-slate-600">
          <p>코스모스 주식회사는 LoRa LPWAN 기반 스마트 주차관제, 센서 네트워크, 엣지 플랫폼, 클라우드 관제 서비스를 개발합니다.</p>
          <p>주요 솔루션은 주차감지센서, LoRa 게이트웨이, 센서 입출력 컨트롤러, 전광판, 엣지 주차관제 플랫폼, 클라우드 주차관제 플랫폼으로 구성됩니다.</p>
          <p>회사는 현장 운영 효율화, 주차 데이터 분석, 무인화 관제, 실시간 상태 모니터링을 목표로 제품과 서비스를 지속적으로 개선합니다.</p>
        </div>
      </section>
    </main>
  );
}
