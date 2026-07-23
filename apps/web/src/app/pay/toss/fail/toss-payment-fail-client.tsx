'use client';

import { getPublicApiBaseUrl } from '@/lib/public-config';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const API_BASE = getPublicApiBaseUrl();

function decodeParam(value: string | null) {
  if (!value) return '-';

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function TossPaymentFailClient() {
  const params = useSearchParams();

  const invoiceId = params.get('invoiceId') ?? '';
  const code = params.get('code') ?? '';
  const message = decodeParam(params.get('message'));
  const orderId = params.get('orderId') ?? '';
  const [couponReleaseMessage, setCouponReleaseMessage] = useState(
    '할인권 예약 상태를 확인하고 있습니다.',
  );
  const [couponReleased, setCouponReleased] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function cancelPreparedPayment() {
      if (!invoiceId) {
        setCouponReleaseMessage('청구서에서 다시 결제를 진행할 수 있습니다.');
        return;
      }

      try {
        const res = await fetch(
          `${API_BASE}/payments/invoice/${invoiceId}/toss/cancel`,
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              code: code || null,
              orderId: orderId || null,
              reason: message === '-' ? 'TOSS_CHECKOUT_FAILED' : message,
            }),
          },
        );
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(json?.message ?? '할인권 예약을 해제하지 못했습니다.');
        }

        if (cancelled) return;

        const released = Boolean(json?.couponReleased);
        setCouponReleased(released);
        setCouponReleaseMessage(
          released
            ? '결제가 취소되어 할인권 예약이 해제되었습니다. 현재 주차 화면에서 할인권을 다시 선택해 주세요.'
            : '결제가 완료되지 않았습니다. 청구서에서 다시 결제를 진행할 수 있습니다.',
        );
      } catch (error: any) {
        if (cancelled) return;
        setCouponReleaseMessage(
          error?.message ??
            '할인권 예약은 최대 15분 후 자동으로 해제됩니다.',
        );
      }
    }

    void cancelPreparedPayment();

    return () => {
      cancelled = true;
    };
  }, [code, invoiceId, message, orderId]);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-950">
      <div className="mx-auto max-w-md">
        <section className="rounded-[2rem] bg-white p-6 text-center shadow-2xl">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-red-600">
            KOSMOS PARKING
          </p>

          <div className="mx-auto mt-6 grid h-16 w-16 place-items-center rounded-full bg-red-50 text-3xl text-red-600">
            !
          </div>

          <h1 className="mt-5 text-2xl font-black text-slate-950">
            결제 실패
          </h1>

          <p className="mt-3 text-sm font-bold text-slate-500">
            결제가 완료되지 않았습니다. 청구서 화면에서 다시 결제할 수 있습니다.
          </p>

          <div className="mt-4 rounded-2xl bg-violet-50 px-4 py-3 text-sm font-bold leading-6 text-violet-700">
            {couponReleaseMessage}
          </div>

          <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-left text-sm font-bold text-slate-700">
            <div className="flex justify-between gap-3 py-1">
              <span className="text-slate-400">실패 코드</span>
              <span className="text-right">{code || '-'}</span>
            </div>
            <div className="flex justify-between gap-3 py-1">
              <span className="text-slate-400">실패 사유</span>
              <span className="text-right">{message}</span>
            </div>
            <div className="flex justify-between gap-3 py-1">
              <span className="text-slate-400">주문번호</span>
              <span className="text-right">{orderId || '-'}</span>
            </div>
          </div>

          <a
            href={
              couponReleased
                ? '/mobile/parking/current'
                : invoiceId
                  ? `/pay/invoice/${invoiceId}`
                  : '/mobile/payments'
            }
            className="mt-6 block rounded-2xl bg-slate-950 px-5 py-4 text-base font-black text-white"
          >
            {couponReleased ? '할인권/요금 다시 확인' : '청구서로 돌아가기'}
          </a>
        </section>
      </div>
    </main>
  );
}
