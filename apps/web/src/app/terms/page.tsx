export default function Page() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <section className="mx-auto max-w-4xl rounded-3xl bg-white p-8 shadow-sm">
        <p className="text-sm font-bold text-blue-600">KOSMOS Parking</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">이용약관</h1>

        <div className="mt-8 space-y-4 text-sm leading-7 text-slate-600">
          <p>본 약관은 코스모스 주차관제 플랫폼의 이용 조건과 절차, 사용자와 회사의 권리 및 의무를 정합니다.</p>
          <p>사용자는 관계 법령과 본 약관을 준수하여 서비스를 이용해야 하며, 시스템의 안정적 운영을 방해하는 행위를 해서는 안 됩니다.</p>
          <p>회사는 서비스 품질 향상, 보안 강화, 법령 준수를 위해 필요한 범위에서 서비스를 변경하거나 개선할 수 있습니다.</p>
        </div>
      </section>
    </main>
  );
}
