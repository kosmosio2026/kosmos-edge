'use client';

import { getPublicApiBaseUrl } from '@/lib/public-config';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API_BASE =
  getPublicApiBaseUrl();

const APP_BASE =
  process.env.NEXT_PUBLIC_APP_URL ?? 'http://172.30.1.95:4000';

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? '';

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('ko-KR');
}

function formatMoney(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return `${num.toLocaleString('ko-KR')}원`;
}

function statusLabel(status?: string | null) {
  switch (status) {
    case 'PAID':
      return '결제 완료';
    case 'PARTIALLY_PAID':
      return '부분 결제';
    case 'ISSUED':
    case 'PENDING':
      return '결제 대기';
    case 'OVERDUE':
      return '미납';
    case 'VOID':
    case 'CANCELED':
      return '취소';
    default:
      return status ?? '-';
  }
}

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-3 text-sm">
      <span className="shrink-0 font-bold text-slate-400">{label}</span>
      <span className="text-right font-black text-slate-900">{value ?? '-'}</span>
    </div>
  );
}

export default function PublicInvoicePage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = String(params?.invoiceId ?? '');

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [preparingToss, setPreparingToss] = useState(false);
  const [message, setMessage] = useState('');
  const [data, setData] = useState<any>(null);
  const [tossPayment, setTossPayment] = useState<any>(null);

  async function loadInvoice() {
    if (!invoiceId) return;

    setLoading(true);
    setMessage('');

    try {
      const res = await fetch(`${API_BASE}/invoices/${invoiceId}/public`, {
        cache: 'no-store',
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.message ?? '청구서 정보를 불러오지 못했습니다.');
      }

      setData(json);
    } catch (error: any) {
      setMessage(error?.message ?? '청구서 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function prepareTossPayment() {
    if (!invoiceId) return;

    setPreparingToss(true);
    setMessage('');

    try {
      const res = await fetch(`${API_BASE}/payments/invoice/${invoiceId}/toss/prepare`, {
        method: 'POST',
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.message ?? 'Toss 결제 준비에 실패했습니다.');
      }

      setTossPayment(json?.payment ?? null);
      setMessage('Toss 결제 준비가 완료되었습니다.');
      return json?.payment ?? null;
    } catch (error: any) {
      setMessage(error?.message ?? 'Toss 결제 준비에 실패했습니다.');
      return null;
    } finally {
      setPreparingToss(false);
    }
  }

  async function startTossCheckout() {
    const preparedPayment = tossPayment ?? await prepareTossPayment();

    if (!preparedPayment) return;

    if (!TOSS_CLIENT_KEY || TOSS_CLIENT_KEY.includes('여기에_')) {
      setMessage('Toss Client Key를 apps/web/.env.local에 설정하세요.');
      return;
    }

    const tossFactory = (window as any).TossPayments;

    if (!tossFactory) {
      setMessage('Toss SDK가 아직 로드되지 않았습니다. 잠시 후 다시 시도하세요.');
      return;
    }

    const tossPayments = tossFactory(TOSS_CLIENT_KEY);

    await tossPayments.requestPayment('카드', {
      amount: Number(preparedPayment.amount),
      orderId: preparedPayment.orderId,
      orderName: `KOSMOS 주차요금 ${invoice.invoiceNo ?? invoiceId}`,
      customerName: invoice.driverName ?? 'KOSMOS 고객',
      successUrl: `${APP_BASE}/pay/toss/success?invoiceId=${invoiceId}`,
      failUrl: `${APP_BASE}/pay/toss/fail?invoiceId=${invoiceId}`,
    });
  }

  async function mockPay() {
    if (!invoiceId) return;

    setPaying(true);
    setMessage('');

    try {
      const invoice = data?.invoice ?? {};
      const amount =
        Number(invoice.unpaidAmount ?? 0) > 0
          ? Number(invoice.unpaidAmount)
          : undefined;

      const res = await fetch(`${API_BASE}/invoices/${invoiceId}/mock-pay`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          method: 'MOCK_CARD',
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.message ?? '테스트 결제에 실패했습니다.');
      }

      setMessage('결제가 완료되었습니다.');
      await loadInvoice();
    } catch (error: any) {
      setMessage(error?.message ?? '테스트 결제에 실패했습니다.');
    } finally {
      setPaying(false);
    }
  }

  useEffect(() => {
    loadInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  const invoice = data?.invoice ?? {};
  const session = data?.session ?? {};
  const pricing = data?.pricing ?? data?.calculation ?? data?.invoice?.metadata ?? {};
  const receipt = data?.receipt ?? data?.invoice?.metadata?.receipt ?? null;

  const placeText = useMemo(() => {
    const lot =
      invoice.parkingLotName ??
      data?.parkingLot?.name ??
      session?.parkingLot?.name ??
      pricing?.parkingLot?.name ??
      '';
    const section =
      invoice.sectionCode ??
      data?.section?.name ??
      data?.section?.code ??
      session?.section?.name ??
      session?.section?.code ??
      pricing?.section?.name ??
      pricing?.section?.code ??
      '';
    const space =
      invoice.parkingSpaceNumber ??
      data?.parkingSpace?.code ??
      data?.parkingSpace?.number ??
      session?.parkingSpace?.code ??
      session?.parkingSpace?.number ??
      pricing?.parkingSpace?.code ??
      pricing?.parkingSpace?.number ??
      '';

    return [lot, section, space].filter(Boolean).join(' · ') || '-';
  }, [data, invoice, session, pricing]);

  const isPaid = invoice.status === 'PAID' || Number(invoice.unpaidAmount ?? 0) <= 0;

  return (
    <>
      <script src="https://js.tosspayments.com/v1/payment"></script>
      <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-950">
      <div className="mx-auto max-w-md">
        <section className="rounded-[2rem] bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">
                KOSMOS PARKING
              </p>
              <h1 className="mt-2 text-2xl font-black text-slate-950">
                청구서 / 영수증
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                주차 요금 청구 내역과 결제 영수증을 확인합니다.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600"
            >
              이전
            </button>
          </div>

          <a
            href="/mobile/payments"
            className="mt-4 block rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm font-black text-slate-700"
          >
            결제/영수증 목록으로 돌아가기
          </a>

          {loading ? (
            <div className="mt-5 rounded-3xl bg-slate-50 p-5 text-sm font-bold text-slate-500">
              청구서 정보를 불러오는 중입니다.
            </div>
          ) : null}

          {!loading && message ? (
            <div className="mt-5 rounded-3xl bg-blue-50 p-5 text-sm font-bold text-blue-700">
              {message}
            </div>
          ) : null}

          {!loading && data ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-3xl bg-blue-50 p-5">
                <p className="text-xs font-bold text-blue-500">결제 상태</p>
                <p className="mt-1 text-2xl font-black text-slate-950">
                  {statusLabel(invoice.status)}
                </p>
                <p className="mt-2 text-sm font-bold text-slate-600">
                  {placeText}
                </p>
              </div>

              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-900">청구 정보</p>
                <div className="mt-2">
                  <InfoRow label="청구서 번호" value={invoice.invoiceNo ?? '-'} />
                  <InfoRow label="세션 번호" value={invoice.sessionNo ?? session.sessionNo ?? '-'} />
                  <InfoRow label="차량번호" value={invoice.plateNumber ?? data?.plateNumber ?? session?.plateNumber ?? pricing?.plateNumber ?? '-'} />
                  <InfoRow label="입차 시간" value={formatDate(invoice.entryTime ?? session?.entryTime ?? pricing?.session?.entryTime)} />
                  <InfoRow label="출차 시간" value={formatDate(invoice.exitTime ?? session?.exitTime ?? pricing?.session?.exitTime)} />
                  <InfoRow label="발행일" value={formatDate(invoice.issuedAt)} />
                  <InfoRow label="결제일" value={formatDate(invoice.paidAt)} />
                </div>
              </div>

              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-900">요금 내역</p>
                <div className="mt-2">
                  <InfoRow label="총 주차 시간" value={(invoice.totalMinutes ?? pricing.totalMinutes) != null ? `${invoice.totalMinutes ?? pricing.totalMinutes}분` : '-'} />
                  <InfoRow label="기본 주차요금" value={formatMoney(invoice.baseParkingAmount ?? pricing.baseParkingAmount ?? invoice.amount)} />
                  <InfoRow label="직접 등록 할인" value={`-${formatMoney(invoice.registrationGraceDiscountAmount ?? pricing.registrationGraceDiscountAmount ?? 0)}`} />
                  <InfoRow label="최종 청구금액" value={formatMoney(invoice.finalAmount ?? invoice.amount)} />
                  <InfoRow label="결제 완료금액" value={formatMoney(invoice.paidAmount)} />
                  <InfoRow label="남은 결제금액" value={formatMoney(invoice.unpaidAmount)} />
                </div>
              </div>

              {receipt ? (
                <div className="rounded-3xl bg-emerald-50 p-4">
                  <p className="text-sm font-black text-emerald-700">영수증</p>
                  <div className="mt-2">
                    <InfoRow label="영수증 번호" value={receipt.receiptNo ?? '-'} />
                    <InfoRow label="승인번호" value={receipt.approvalNo ?? receipt.approvalNumber ?? '-'} />
                    <InfoRow label="결제수단" value={receipt.method ?? receipt.paymentMethod ?? '테스트 카드'} />
                    <InfoRow label="결제금액" value={formatMoney(receipt.amount ?? receipt.paidAmount ?? invoice.paidAmount)} />
                    <InfoRow label="결제일시" value={formatDate(receipt.paidAt ?? invoice.paidAt)} />
                  </div>
                </div>
              ) : null}

              {!isPaid ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={startTossCheckout}
                    disabled={preparingToss}
                    className="w-full rounded-2xl bg-slate-950 px-5 py-4 text-center text-base font-black text-white shadow-lg shadow-slate-950/20 disabled:opacity-50"
                  >
                    {preparingToss ? 'Toss 결제 준비 중...' : 'Toss 결제창 열기'}
                  </button>

                  {tossPayment ? (
                    <div className="rounded-2xl bg-slate-100 px-4 py-4 text-sm font-bold text-slate-700">
                      <p className="font-black text-slate-950">Toss 결제 준비 완료</p>
                      <p className="mt-2">주문번호: {tossPayment.orderId}</p>
                      <p>결제금액: {formatMoney(tossPayment.amount)}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        Toss 결제창 호출 준비가 완료되었습니다.
                      </p>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={mockPay}
                    disabled={paying}
                    className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-center text-base font-black text-white shadow-lg shadow-blue-600/20 disabled:opacity-50"
                  >
                    {paying ? '결제 처리 중...' : '테스트 결제하기'}
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl bg-emerald-600 px-5 py-4 text-center text-base font-black text-white">
                  결제가 완료되었습니다.
                </div>
              )}
            </div>
          ) : null}
        </section>
      </div>
      </main>
    </>
  );
}
