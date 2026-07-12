'use client';

import { getPublicApiBaseUrl } from '@/lib/public-config';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const API_BASE =
  getPublicApiBaseUrl();

export default function TossSuccessClientPage() {
  const params = useSearchParams();

  const paymentKey = params.get('paymentKey') ?? '';
  const orderId = params.get('orderId') ?? '';
  const amount = Number(params.get('amount') ?? 0);
  const invoiceId = params.get('invoiceId') ?? '';

  const [message, setMessage] = useState('Toss 결제 승인 처리 중입니다.');
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function confirm() {
      if (!paymentKey || !orderId || !amount) {
        setMessage('결제 승인 정보가 부족합니다.');
        setDone(true);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/payments/toss/public-confirm`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            paymentKey,
            orderId,
            amount,
            invoiceId,
          }),
        });

        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.message ?? 'Toss 결제 승인에 실패했습니다.');
        }

        setMessage('결제가 완료되었습니다.');
      } catch (error: any) {
        setMessage(error?.message ?? 'Toss 결제 승인에 실패했습니다.');
      } finally {
        setDone(true);
      }
    }

    confirm();
  }, [paymentKey, orderId, amount]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-950">
      <section className="mx-auto max-w-md rounded-[2rem] bg-white p-5 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">
          KOSMOS PARKING
        </p>

        <h1 className="mt-2 text-2xl font-black text-slate-950">
          결제 승인
        </h1>

        <div className="mt-5 rounded-3xl bg-slate-50 p-5 text-sm font-bold text-slate-700">
          {message}
        </div>

        <div className="mt-5 space-y-2 text-sm font-bold text-slate-500">
          <p>주문번호: {orderId || '-'}</p>
          <p>결제금액: {amount ? `${amount.toLocaleString('ko-KR')}원` : '-'}</p>
        </div>

        {done ? (
          <a
            href={invoiceId ? `/pay/invoice/${invoiceId}` : '/mobile/payments'}
            className="mt-5 block rounded-2xl bg-blue-600 px-5 py-4 text-center text-base font-black text-white"
          >
            청구서/영수증으로 돌아가기
          </a>
        ) : null}
      </section>
    </main>
  );
}
