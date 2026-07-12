'use client';

import { useSearchParams } from 'next/navigation';

export default function TossFailClientPage() {
  const params = useSearchParams();

  const code = params.get('code') ?? '';
  const message = params.get('message') ?? '';
  const invoiceId = params.get('invoiceId') ?? '';

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-950">
      <section className="mx-auto max-w-md rounded-[2rem] bg-white p-5 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-600">
          KOSMOS PARKING
        </p>

        <h1 className="mt-2 text-2xl font-black text-slate-950">
          결제가 완료되지 않았습니다
        </h1>

        <div className="mt-5 rounded-3xl bg-red-50 p-5 text-sm font-bold text-red-700">
          {message || '결제가 취소되었거나 실패했습니다.'}
        </div>

        <div className="mt-5 space-y-2 text-sm font-bold text-slate-500">
          <p>오류코드: {code || '-'}</p>
        </div>

        <a
          href={invoiceId ? `/pay/invoice/${invoiceId}` : '/mobile/payments'}
          className="mt-5 block rounded-2xl bg-slate-900 px-5 py-4 text-center text-base font-black text-white"
        >
          청구서/영수증으로 돌아가기
        </a>
      </section>
    </main>
  );
}
