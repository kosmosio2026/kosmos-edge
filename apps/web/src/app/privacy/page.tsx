export default function Page() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm">
        <p className="text-sm font-bold text-blue-600">KOSMOS Parking</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">개인정보보호정책</h1>

        <div className="mt-8 space-y-4 text-sm leading-7 text-slate-600">
          <p>회사는 회원 식별, 차량 등록, 주차요금 정산, 고객 지원, 보안 관리를 위해 필요한 최소한의 개인정보를 처리합니다.</p>
          <p>주요 처리 항목은 이름, 이메일, 전화번호, 차량번호, 주차 이용 내역, 결제 상태 등입니다.</p>
          <p>개인정보는 관계 법령과 내부 보안 정책에 따라 안전하게 관리하며, 목적 달성 후 지체 없이 파기하거나 별도 보관합니다.</p>
        </div>
      </section>
    </main>
  );
}
