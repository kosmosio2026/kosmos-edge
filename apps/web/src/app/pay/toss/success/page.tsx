import { Suspense } from 'react';
import TossPaymentSuccessClient from './toss-payment-success-client';

function Fallback() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-950">
      <div className="mx-auto max-w-md">
        <section className="rounded-[2rem] bg-white p-6 text-center shadow-2xl">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-600">
            KOSMOS PARKING
          </p>
          <h1 className="mt-5 text-2xl font-black text-slate-950">
            결제 확인 중
          </h1>
          <p className="mt-3 text-sm font-bold text-slate-500">
            결제 승인 정보를 확인하고 있습니다.
          </p>
        </section>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Fallback />}>
      <TossPaymentSuccessClient />
    </Suspense>
  );
}
