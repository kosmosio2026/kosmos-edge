export default function Page() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm">
        <p className="text-sm font-bold text-blue-600">KOSMOS Parking</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">연락처</h1>

        <div className="mt-8 space-y-4 text-sm leading-7 text-slate-600">
          <p>서비스 이용, 장애 신고, 제휴 및 도입 문의는 아래 연락처를 통해 접수할 수 있습니다.</p>
          <p>대표번호: 000-0000-0000</p>
          <p>이메일: contact@kosmos.local</p>
          <p>운영시간: 평일 09:00 ~ 18:00, 공휴일 제외</p>
        </div>
      </section>
    </main>
  );
}
