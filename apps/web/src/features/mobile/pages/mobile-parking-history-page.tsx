'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MobileAppShell } from '@/components/mobile/mobile-app-shell';

type MobileHistorySessionType = 'member' | 'visitor';

type HistoryRow = {
  id: string;
  parkingLotName: string;
  sectionLabel: string;
  spaceLabel: string;
  plateNumber: string;
  entryTime: string | null;
  exitTime: string | null;
  sessionStatus: string;
  invoiceId: string | null;
  invoiceStatus: string | null;
  finalAmount: number | null;
  paidAmount: number | null;
  unpaidAmount: number | null;
};

function trimTrailingSlash(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (typeof window !== 'undefined') {
    return `${trimTrailingSlash(window.location.origin)}/api`;
  }

  return 'http://localhost:3000/api';
}

function pick(...values: any[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return null;
}

function pickObject(...values: any[]) {
  for (const value of values) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value;
    }
  }

  return {};
}

function asArray(payload: any): any[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  if (Array.isArray(payload?.rows)) {
    return payload.rows;
  }

  if (Array.isArray(payload?.history)) {
    return payload.history;
  }

  return [];
}

function toNumber(value: any): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);

  return Number.isNaN(parsed) ? null : parsed;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(value: number | null) {
  if (value === null || value === undefined) {
    return '-';
  }

  return `${Number(value).toLocaleString('ko-KR')}원`;
}

function resolveAccessToken(sessionType: MobileHistorySessionType) {
  if (typeof window === 'undefined') {
    return '';
  }

  if (sessionType === 'visitor') {
    return (
      window.localStorage.getItem('kosmos.visitorAccessToken') ??
      window.localStorage.getItem('kosmos.mobileAccessToken') ??
      ''
    );
  }

  return (
    window.localStorage.getItem('kosmos.mobileAccessToken') ??
    window.localStorage.getItem('kosmos.memberAccessToken') ??
    ''
  );
}

function redirectToLogin(sessionType: MobileHistorySessionType) {
  if (typeof window === 'undefined') {
    return;
  }

  const loginPath = sessionType === 'visitor' ? '/mobile/visitor/login' : '/mobile/member/login';
  const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);

  window.location.href = `${loginPath}?next=${next}`;
}

function getSessionStatusLabel(status: string, exitTime: string | null) {
  const normalized = String(status ?? '').toUpperCase();

  if (['ACTIVE', 'GRACE_PERIOD'].includes(normalized)) {
    return '주차 중';
  }

  if (['ENDED', 'EXITED', 'COMPLETED'].includes(normalized) || exitTime) {
    return '주차 종료';
  }

  if (!normalized) {
    return '-';
  }

  return normalized;
}

function getInvoiceStatusLabel(status: string | null, unpaidAmount: number | null) {
  const normalized = String(status ?? '').toUpperCase();

  if (unpaidAmount !== null && unpaidAmount > 0 && !['PAID', 'VOID', 'CANCELED'].includes(normalized)) {
    return '결제 필요';
  }

  switch (normalized) {
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
      return normalized || '청구서 없음';
  }
}

function getInvoiceBadgeClass(status: string | null, unpaidAmount: number | null) {
  const normalized = String(status ?? '').toUpperCase();

  if (unpaidAmount !== null && unpaidAmount > 0 && !['PAID', 'VOID', 'CANCELED'].includes(normalized)) {
    return 'bg-amber-100 text-amber-700 ring-amber-200';
  }

  switch (normalized) {
    case 'PAID':
      return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
    case 'OVERDUE':
      return 'bg-red-100 text-red-700 ring-red-200';
    case 'ISSUED':
    case 'PENDING':
    case 'PARTIALLY_PAID':
      return 'bg-amber-100 text-amber-700 ring-amber-200';
    case 'VOID':
    case 'CANCELED':
      return 'bg-slate-100 text-slate-500 ring-slate-200';
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
}

function normalizeHistoryRow(item: any, index: number): HistoryRow {
  const session = pickObject(item.parkingSession, item.session, item);
  const invoice = pickObject(item.invoice);
  const parkingLot = pickObject(item.parkingLot, session.parkingLot, invoice.parkingLot);
  const section = pickObject(item.section, session.section, invoice.section);
  const parkingSpace = pickObject(item.parkingSpace, session.parkingSpace, invoice.parkingSpace);

  const sectionLabel = [
    pick(section.code, item.sectionCode, session.sectionCode, invoice.sectionCode),
    pick(section.name, item.sectionName, session.sectionName, invoice.sectionName),
  ]
    .filter(Boolean)
    .join(' - ');

  const spaceLabel = pick(
    parkingSpace.code,
    parkingSpace.number,
    item.spaceCode,
    item.parkingSpaceCode,
    item.parkingSpaceNumber,
    session.spaceCode,
    session.parkingSpaceCode,
    session.parkingSpaceNumber,
    invoice.spaceCode,
    invoice.parkingSpaceNumber,
  );

  const finalAmount = toNumber(pick(invoice.finalAmount, item.finalAmount, invoice.amount, item.amount));
  const paidAmount = toNumber(pick(invoice.paidAmount, item.paidAmount, 0));
  const unpaidAmount = toNumber(
    pick(
      invoice.unpaidAmount,
      item.unpaidAmount,
      finalAmount !== null && paidAmount !== null ? Math.max(0, finalAmount - paidAmount) : null,
    ),
  );

  return {
    id: String(pick(item.id, session.id, invoice.id, index)),
    parkingLotName: String(
      pick(
        parkingLot.name,
        item.parkingLotName,
        session.parkingLotName,
        invoice.parkingLotName,
        '주차장',
      ),
    ),
    sectionLabel: String(sectionLabel || '-'),
    spaceLabel: String(spaceLabel ?? '-'),
    plateNumber: String(
      pick(
        item.plateNumber,
        item.vehiclePlate,
        item.vehiclePlateNumber,
        session.plateNumber,
        session.vehiclePlate,
        session.vehiclePlateNumber,
        invoice.plateNumber,
        '-',
      ),
    ),
    entryTime: pick(item.entryTime, session.entryTime, invoice.entryTime),
    exitTime: pick(item.exitTime, session.exitTime, invoice.exitTime),
    sessionStatus: String(pick(item.status, item.sessionStatus, session.status, invoice.sessionStatus, '')),
    invoiceId: pick(invoice.id, item.invoiceId),
    invoiceStatus: pick(invoice.status, item.invoiceStatus),
    finalAmount,
    paidAmount,
    unpaidAmount,
  };
}

export default function MobileParkingHistoryPage({
  sessionType,
}: {
  sessionType: MobileHistorySessionType;
}) {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [items, setItems] = useState<HistoryRow[]>([]);

  const loadHistory = useCallback(async () => {
    const token = resolveAccessToken(sessionType);

    if (!token) {
      redirectToLogin(sessionType);
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${getApiBaseUrl()}/mobile/payments`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.message ?? '주차 이력을 불러오지 못했습니다.');
      }

      const rows = asArray(data)
        .map((item, index) => normalizeHistoryRow(item, index))
        .sort((a, b) => {
          const aTime = a.entryTime ? new Date(a.entryTime).getTime() : 0;
          const bTime = b.entryTime ? new Date(b.entryTime).getTime() : 0;

          return bTime - aTime;
        });

      setItems(rows);
    } catch (error: any) {
      setMessage(error?.message ?? '주차 이력을 불러오지 못했습니다.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [sessionType]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const summary = useMemo(() => {
    const active = items.filter((item) =>
      ['ACTIVE', 'GRACE_PERIOD'].includes(String(item.sessionStatus).toUpperCase()),
    ).length;
    const unpaid = items.filter((item) => Number(item.unpaidAmount ?? 0) > 0).length;
    const paid = items.filter((item) => String(item.invoiceStatus ?? '').toUpperCase() === 'PAID').length;

    return {
      total: items.length,
      active,
      unpaid,
      paid,
    };
  }, [items]);

  return (
    <MobileAppShell
      title="주차 이력"
      subtitle="이전 주차와 결제 상태를 확인하세요."
      sessionType={sessionType}
    >
      <div className="mx-auto max-w-md">
        <section className="rounded-[2rem] bg-white p-5 shadow-2xl">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-3xl bg-blue-50 p-4">
              <p className="text-xs font-bold text-blue-500">전체</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{summary.total}</p>
            </div>

            <div className="rounded-3xl bg-emerald-50 p-4">
              <p className="text-xs font-bold text-emerald-600">결제 완료</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{summary.paid}</p>
            </div>

            <div className="rounded-3xl bg-amber-50 p-4">
              <p className="text-xs font-bold text-amber-600">결제 필요</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{summary.unpaid}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadHistory()}
            disabled={loading}
            className="mt-4 w-full rounded-2xl bg-slate-950 px-5 py-4 text-center text-sm font-black text-white disabled:opacity-50"
          >
            {loading ? '불러오는 중...' : '주차 이력 새로고침'}
          </button>

          {loading ? (
            <div className="mt-5 rounded-3xl bg-slate-50 p-5 text-sm font-bold text-slate-500">
              주차 이력을 불러오는 중입니다.
            </div>
          ) : null}

          {!loading && message ? (
            <div className="mt-5 rounded-3xl bg-red-50 p-5 text-sm font-bold text-red-600">
              {message}
            </div>
          ) : null}

          {!loading && !message && items.length === 0 ? (
            <div className="mt-5 rounded-3xl bg-slate-50 p-5">
              <p className="text-lg font-black text-slate-900">주차 이력이 없습니다.</p>
              <p className="mt-2 text-sm text-slate-500">
                주차 등록 또는 결제 내역이 생기면 이곳에 표시됩니다.
              </p>
            </div>
          ) : null}

          {!loading && items.length > 0 ? (
            <div className="mt-5 space-y-3">
              {items.map((item) => (
                <article
                  key={`${item.id}-${item.invoiceId ?? 'no-invoice'}`}
                  className="rounded-3xl border border-slate-100 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-black text-slate-950">
                        {item.parkingLotName}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-400">
                        {item.sectionLabel} · {item.spaceLabel} · {item.plateNumber}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ring-1 ${getInvoiceBadgeClass(
                        item.invoiceStatus,
                        item.unpaidAmount,
                      )}`}
                    >
                      {getInvoiceStatusLabel(item.invoiceStatus, item.unpaidAmount)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-2xl bg-white p-3">
                      <p className="text-xs font-bold text-slate-400">입차</p>
                      <p className="mt-1 text-xs font-black text-slate-800">
                        {formatDateTime(item.entryTime)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-white p-3">
                      <p className="text-xs font-bold text-slate-400">출차</p>
                      <p className="mt-1 text-xs font-black text-slate-800">
                        {['ACTIVE', 'GRACE_PERIOD'].includes(
                          String(item.sessionStatus).toUpperCase(),
                        )
                          ? '주차 중'
                          : formatDateTime(item.exitTime)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl bg-white p-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold text-slate-400">주차 상태</span>
                      <span className="font-black text-slate-900">
                        {getSessionStatusLabel(item.sessionStatus, item.exitTime)}
                      </span>
                    </div>

                    <div className="mt-1 flex justify-between text-sm">
                      <span className="font-bold text-slate-400">청구 금액</span>
                      <span className="font-black text-slate-900">
                        {formatMoney(item.finalAmount)}
                      </span>
                    </div>

                    <div className="mt-1 flex justify-between text-sm">
                      <span className="font-bold text-slate-400">결제 금액</span>
                      <span className="font-black text-slate-900">
                        {formatMoney(item.paidAmount)}
                      </span>
                    </div>

                    <div className="mt-1 flex justify-between text-sm">
                      <span className="font-bold text-slate-400">미결제 금액</span>
                      <span className="font-black text-slate-900">
                        {formatMoney(item.unpaidAmount)}
                      </span>
                    </div>
                  </div>

                  {item.invoiceId ? (
                    <a
                      href={`/pay/invoice/${item.invoiceId}`}
                      className="mt-3 block rounded-2xl bg-slate-900 px-4 py-3 text-center text-sm font-black text-white"
                    >
                      청구서/영수증 보기
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </MobileAppShell>
  );
}
