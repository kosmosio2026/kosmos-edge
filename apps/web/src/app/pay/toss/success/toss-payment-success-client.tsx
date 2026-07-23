'use client';

import { getPublicApiBaseUrl } from '@/lib/public-config';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const API_BASE = getPublicApiBaseUrl();

function formatMoney(value?: string | number | null) {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return `${num.toLocaleString('ko-KR')}원`;
}

export default function TossPaymentSuccessClient() {
  const router = useRouter();
  const params = useSearchParams();

  const invoiceId = params.get('invoiceId') ?? '';
  const paymentKey = params.get('paymentKey') ?? '';
  const orderId = params.get('orderId') ?? '';
  const amount = Number(params.get('amount') ?? 0);

  const [status, setStatus] = useState<'confirming' | 'success' | 'error'>('confirming');
  const [message, setMessage] = useState('결제 승인 정보를 확인하고 있습니다.');

  useEffect(() => {
    let cancelled = false;

    async function confirmPayment() {
      if (!invoiceId || !paymentKey || !orderId || !amount) {
        setStatus('error');
        setMessage('결제 승인 정보가 올바르지 않습니다.');
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/payments/toss/public-confirm`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            invoiceId,
            paymentKey,
            orderId,
            amount,
          }),
        });

        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(json?.message ?? '결제 승인 처리에 실패했습니다.');
        }

        if (cancelled) return;

        setStatus('success');
        setMessage('결제가 완료되었습니다. 영수증 화면으로 이동합니다.');

        window.setTimeout(() => {
          router.replace(`/pay/invoice/${invoiceId}`);
        }, 900);
      } catch (error: any) {
        if (cancelled) return;

        setStatus('error');
        setMessage(error?.message ?? '결제 승인 처리에 실패했습니다.');
      }
    }

    void confirmPayment();

    return () => {
      cancelled = true;
    };
  }, [amount, invoiceId, orderId, paymentKey, router]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-950">
      <div className="mx-auto max-w-md">
        <section className="rounded-[2rem] bg-white p-6 text-center shadow-2xl">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-600">
            KOSMOS PARKING
          </p>

          <div
            className={`mx-auto mt-6 grid h-16 w-16 place-items-center rounded-full text-3xl ${
              status === 'error'
                ? 'bg-red-50 text-red-600'
                : status === 'success'
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-blue-50 text-blue-600'
            }`}
          >
            {status === 'error' ? '!' : status === 'success' ? '✓' : '…'}
          </div>

          <h1 className="mt-5 text-2xl font-black text-slate-950">
            {status === 'error'
              ? '결제 확인 실패'
              : status === 'success'
                ? '결제 완료'
                : '결제 확인 중'}
          </h1>

          <p className="mt-3 text-sm font-bold text-slate-500">{message}</p>

          <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-left text-sm font-bold text-slate-700">
            <div className="flex justify-between gap-3 py-1">
              <span className="text-slate-400">청구서</span>
              <span className="text-right">{invoiceId || '-'}</span>
            </div>
            <div className="flex justify-between gap-3 py-1">
              <span className="text-slate-400">주문번호</span>
              <span className="text-right">{orderId || '-'}</span>
            </div>
            <div className="flex justify-between gap-3 py-1">
              <span className="text-slate-400">결제금액</span>
              <span className="text-right">{formatMoney(amount)}</span>
            </div>
          </div>

          <a
            href={
              status === 'error'
                ? '/mobile/parking/current'
                : invoiceId
                  ? `/pay/invoice/${invoiceId}`
                  : '/mobile/payments'
            }
            className="mt-6 block rounded-2xl bg-slate-950 px-5 py-4 text-base font-black text-white"
          >
            {status === 'error'
              ? '할인권/요금 다시 확인'
              : '청구서/영수증 보기'}
          </a>
        </section>
      </div>
    </main>
  );
}
