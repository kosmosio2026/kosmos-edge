export default function Page() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm">
        <p className="text-sm font-bold text-blue-600">KOSMOS Parking</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">위치정보이용약관</h1>

        <div className="mt-8 space-y-4 text-sm leading-7 text-slate-600">
          <p>본 약관은 주차장 위치 확인, 주차장 지도 표시, 주차면 안내 등 위치기반 서비스 제공에 필요한 사항을 정합니다.</p>
          <p>위치정보는 주차장 검색, 주차면 안내, 현장 운영 관리를 위한 목적으로만 사용됩니다.</p>
          <p>사용자는 단말기 또는 브라우저 설정을 통해 위치정보 제공을 제한할 수 있습니다.</p>
        </div>
      </section>
    </main>
  );
}
