'use client';

import { getPublicApiBaseUrl } from '@/lib/public-config';
import { useEffect, useMemo, useState } from 'react';
import { MobileAppShell } from '@/components/mobile/mobile-app-shell';

const API_BASE =
  getPublicApiBaseUrl();

function getToken() {
  if (typeof window === 'undefined') return '';

  return (
    localStorage.getItem('kosmos.mobileAccessToken') ??
    localStorage.getItem('kosmos.visitorAccessToken') ??
    ''
  );
}

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

function getCurrentParkingSessionId() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('kosmos.currentParkingSessionId') ?? '';
}

function withCurrentSessionId(path: string) {
  const sessionId = getCurrentParkingSessionId();
  return sessionId ? `${path}?sessionId=${encodeURIComponent(sessionId)}` : path;
}

function invoiceStatusLabel(status?: string | null) {
  switch (status) {
    case 'PAID':
      return '결제 완료';
    case 'PARTIALLY_PAID':
      return '부분 결제';
    case 'VOID':
    case 'CANCELED':
      return '취소';
    case 'ISSUED':
    case 'PENDING':
      return '결제 대기';
    case 'OVERDUE':
      return '미납';
    default:
      return status ?? '청구서 없음';
  }
}

function isAdditionalFeeInvoice(item: any) {
  const invoice = item?.invoice ?? {};
  const metadata = invoice?.metadata ?? {};
  const paidAmount = Number(invoice?.paidAmount ?? 0);
  const unpaidAmount = Number(invoice?.unpaidAmount ?? 0);

  return (
    metadata?.invoiceKind === 'ADDITIONAL_FEE' ||
    metadata?.invoiceTitle === '추가 요금 청구서' ||
    Boolean(metadata?.isAdditionalFeeInvoice) ||
    (paidAmount > 0 && unpaidAmount > 0)
  );
}

function invoiceDisplayTitle(item: any) {
  const metadata = item?.invoice?.metadata ?? {};

  if (metadata?.invoiceTitle) return metadata.invoiceTitle;
  if (isAdditionalFeeInvoice(item)) return '추가 요금 청구서';

  return '주차 요금 청구서';
}

function invoiceBadgeLabel(item: any) {
  const unpaidAmount = Number(item?.invoice?.unpaidAmount ?? 0);

  if (isAdditionalFeeInvoice(item) && unpaidAmount > 0) {
    return '추가 요금 결제 대기';
  }

  return invoiceStatusLabel(item?.invoice?.status);
}

function invoiceBadgeClass(item: any) {
  const status = item?.invoice?.status;
  const unpaidAmount = Number(item?.invoice?.unpaidAmount ?? 0);

  if (isAdditionalFeeInvoice(item) && unpaidAmount > 0) {
    return 'bg-fuchsia-100 text-fuchsia-700 ring-fuchsia-200';
  }

  switch (status) {
    case 'PAID':
      return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
    case 'ISSUED':
    case 'PENDING':
    case 'PARTIALLY_PAID':
      return 'bg-amber-100 text-amber-700 ring-amber-200';
    case 'OVERDUE':
      return 'bg-red-100 text-red-700 ring-red-200';
    case 'VOID':
    case 'CANCELED':
      return 'bg-slate-100 text-slate-500 ring-slate-200';
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

export default function MobilePaymentsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [items, setItems] = useState<any[]>([]);

  async function loadPayments() {
    const token = getToken();

    if (!token) {
      window.location.href = '/mobile';
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/mobile/payments`, {
        headers: {
          authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message ?? '결제 정보를 불러오지 못했습니다.');
      }

      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (error: any) {
      setMessage(error?.message ?? '결제 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function finalizeCurrentInvoice() {
    const token = getToken();

    if (!token) {
      window.location.href = '/mobile';
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const res = await fetch(`${API_BASE}${withCurrentSessionId('/mobile/parking/current/finalize-invoice')}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message ?? '청구서를 생성하지 못했습니다.');
      }

      setMessage(data?.invoice?.metadata?.invoiceTitle === '추가 요금 청구서' ? '추가 요금 청구서가 생성되었습니다.' : '청구서가 생성/갱신되었습니다.');
      await loadPayments();
    } catch (error: any) {
      setMessage(error?.message ?? '청구서를 생성하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadPayments();
  }, []);

  const unpaidItems = useMemo(
    () =>
      items.filter((item) => {
        const status = item?.invoice?.status;
        return status && !['PAID', 'VOID', 'CANCELED'].includes(status);
      }),
    [items],
  );

  return (
    <MobileAppShell
      title="결제/영수증"
      subtitle="주차 요금, 결제 상태, 영수증을 확인하세요."
      sessionType="member"
    >
      <div className="mx-auto max-w-md">
        <section className="rounded-[2rem] bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">
                PAYMENTS
              </p>
              <h1 className="mt-2 text-2xl font-black text-slate-950">
                결제/영수증
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                주차 요금, 결제 상태, 영수증 정보를 확인합니다.
              </p>
            </div>

            <a
              href="/mobile"
              className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600"
            >
              홈
            </a>
          </div>

          <div className="mt-5">
            <button
              type="button"
              onClick={finalizeCurrentInvoice}
              disabled={saving}
              className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-center text-base font-black text-white shadow-lg shadow-blue-600/20 disabled:opacity-50"
            >
              {saving ? '청구서 생성 중...' : '현재 주차 청구서 생성/갱신'}
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-3xl bg-blue-50 p-4">
              <p className="text-xs font-bold text-blue-500">전체 내역</p>
              <p className="mt-1 text-2xl font-black text-slate-950">
                {items.length}
              </p>
            </div>

            <div className="rounded-3xl bg-red-50 p-4">
              <p className="text-xs font-bold text-red-500">결제 필요</p>
              <p className="mt-1 text-2xl font-black text-slate-950">
                {unpaidItems.length}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="mt-5 rounded-3xl bg-slate-50 p-5 text-sm font-bold text-slate-500">
              결제 정보를 불러오는 중입니다.
            </div>
          ) : null}

          {!loading && message ? (
            <div className="mt-5 rounded-3xl bg-red-50 p-5 text-sm font-bold text-red-600">
              {message}
            </div>
          ) : null}

          {!loading && !message && items.length === 0 ? (
            <div className="mt-5 rounded-3xl bg-slate-50 p-5">
              <p className="text-lg font-black text-slate-900">
                결제/영수증 내역이 없습니다.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                주차 완료 후 청구서가 생성되면 이곳에 표시됩니다.
              </p>
            </div>
          ) : null}

          {!loading && items.length > 0 ? (
            <div className="mt-5 space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-3xl border border-slate-100 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-black text-slate-950">
                        {item.parkingLot?.name ?? '주차장'}
                      </p>
                      <p className={`mt-1 text-sm font-black ${isAdditionalFeeInvoice(item) ? 'text-fuchsia-700' : 'text-slate-700'}`}>
                        {invoiceDisplayTitle(item)}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-400">
                        {item.section?.name ? `${item.section.name} · ` : ''}
                        {item.parkingSpace?.code ?? '-'} · {item.plateNumber ?? '-'}
                      </p>
                    </div>

                    <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${invoiceBadgeClass(item)}`}
                      >
                        {invoiceBadgeLabel(item)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-white p-3">
                      <p className="text-xs font-bold text-slate-400">입차</p>
                      <p className="mt-1 text-xs font-black text-slate-800">
                        {formatDate(item.entryTime)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white p-3">
                      <p className="text-xs font-bold text-slate-400">출차</p>
                      <p className="mt-1 text-xs font-black text-slate-800">
                        {formatDate(item.exitTime)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl bg-white p-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-slate-400">청구 금액</span>
                      <span className="font-black text-slate-900">
                        {formatMoney(item.invoice?.finalAmount ?? item.invoice?.amount)}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between text-sm">
                      <span className="font-bold text-slate-400">결제 금액</span>
                      <span className="font-black text-slate-900">
                        {formatMoney(item.invoice?.paidAmount)}
                      </span>
                    </div>
                  </div>

                  {item.invoice?.id ? (
                    <a
                      href={`/pay/invoice/${item.invoice.id}`}
                      className="mt-3 block rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-black text-white"
                    >
                      결제/영수증 보기
                    </a>
                  ) : (
                    <p className="mt-3 rounded-2xl bg-white px-4 py-3 text-center text-xs font-bold text-slate-400">
                      아직 청구서가 생성되지 않았습니다.
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </MobileAppShell>
  );
}
