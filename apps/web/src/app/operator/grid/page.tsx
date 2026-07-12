'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';

type LiveSpace = {
  id?: string;
  parkingSpaceId?: string;
  parkingLotId?: string;
  parkingLotName?: string;
  sectionId?: string;
  sectionCode?: string;
  sectionName?: string | null;
  spaceId?: string;
  spaceCode?: string;
  spaceNumber?: string | null;
  type?: string | null;
  code?: string;
  state?: string;
  color?: string;
  sensorStatus?: string | null;
  activeSession?: {
      id?: string | null;
      plateNumber?: string | null;
      vehiclePlate?: string | null;
      entryTime?: string | null;
      accruedFeeAmount?: number | null;
      accruedAmount?: number | null;
      paymentStatus?: string | null;
      isRegistered?: boolean | null;
      elapsedMinutes?: number | null;
    } | null;
};

type LiveResponse = {
  ok?: boolean;
  generatedAt?: string;
  spaces?: LiveSpace[];
};

function getSpaceId(space: LiveSpace) {
  return space.parkingSpaceId ?? space.spaceId ?? space.id ?? space.spaceCode ?? '';
}

function getSpaceCode(space: LiveSpace) {
  return space.spaceCode ?? space.code ?? space.spaceNumber ?? '-';
}

function getStateLabel(state?: string) {
  switch (state) {
    case 'EMPTY':
      return '빈면';
    case 'OCCUPIED':
      return '주차중';
    case 'REGISTERED':
      return '등록';
    case 'UNREGISTERED_OVERDUE':
      return '미등록 초과';
    case 'PAYMENT_GRACE_EXPIRED':
      return '출차 유예 초과';
    case 'LONG_PARKING_ALERT':
      return '장기 주차';
    case 'SENSOR_ERROR':
      return '센서 오류';
    case 'DISABLED':
      return '비활성';
    default:
      return state ?? '-';
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR');
}


function getSessionAmount(space: LiveSpace) {
  return space.activeSession?.accruedFeeAmount ?? space.activeSession?.accruedAmount ?? null;
}

function getSessionPaymentStatus(space: LiveSpace) {
  return String(space.activeSession?.paymentStatus ?? '').toUpperCase();
}

function needsRegistrationAction(space: LiveSpace) {
  const state = String(space.state ?? '').toUpperCase();
  return (
    Boolean(space.activeSession) &&
    !space.activeSession?.isRegistered &&
    (state === 'OCCUPIED_UNREGISTERED' || state === 'UNREGISTERED_OVERDUE')
  );
}

function isPaidAction(space: LiveSpace) {
  const status = getSessionPaymentStatus(space);
  return ['PAID', 'PAID_MANUAL', 'SETTLED', 'COMPLETED'].includes(status);
}

function shouldShowInvoiceAction(space: LiveSpace) {
  if (!space.activeSession) return false;
  if (isPaidAction(space)) return false;

  const amount = getSessionAmount(space);
  const status = getSessionPaymentStatus(space);

  return (
    Number(amount ?? 0) > 0 ||
    ['UNPAID', 'PENDING', 'ACCRUING', 'ADDITIONAL_FEE_REQUIRED'].includes(status)
  );
}

function getSpaceActionHref(space: LiveSpace, action: 'register' | 'payment' | 'detail') {
  return `/operator/parking/sessions?space=${encodeURIComponent(getSpaceCode(space))}&action=${action}`;
}

function renderSpaceAction(space: LiveSpace) {
  if (needsRegistrationAction(space)) {
    return (
      <Link
        href={getSpaceActionHref(space, 'register')}
        className="inline-flex justify-center whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white"
      >
        주차 등록
      </Link>
    );
  }

  if (isPaidAction(space)) {
    return (
      <Link
        href={getSpaceActionHref(space, 'detail')}
        className="inline-flex justify-center whitespace-nowrap rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white"
      >
        영수증
      </Link>
    );
  }

  if (shouldShowInvoiceAction(space)) {
    return (
      <Link
        href={getSpaceActionHref(space, 'payment')}
        className="inline-flex justify-center whitespace-nowrap rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white"
      >
        청구서
      </Link>
    );
  }

  return <span className="text-xs font-bold text-slate-300">-</span>;
}

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined) return '-';
  return `₩${Number(value).toLocaleString('ko-KR')}`;
}

export default function OperatorGridPage() {
  const { session } = useAuth();

  const [spaces, setSpaces] = useState<LiveSpace[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sectionFilter, setSectionFilter] = useState('');

  const sections = useMemo(() => {
    const map = new Map<string, string>();

    for (const space of spaces) {
      if (!space.sectionId) continue;
      const label = `${space.parkingLotName ?? '-'} / ${space.sectionCode ?? space.sectionName ?? '-'}`;
      map.set(space.sectionId, label);
    }

    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [spaces]);

  const filteredSpaces = useMemo(() => {
    if (!sectionFilter) return spaces;
    return spaces.filter((space) => space.sectionId === sectionFilter);
  }, [spaces, sectionFilter]);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setMessage('');

    try {
      const data = await apiFetch<LiveResponse>('/parking-monitor/spaces/live', {
        accessToken: session.accessToken,
      });

      setSpaces(Array.isArray(data?.spaces) ? data.spaces : []);
      setGeneratedAt(data?.generatedAt ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '주차면 현황을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">Operator Grid</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">담당 주차 구역 현황</h1>
            <p className="mt-2 text-sm text-slate-500">
              승인받은 주차 구역의 주차면만 표시됩니다.
            </p>
            {generatedAt ? (
              <p className="mt-1 text-xs text-slate-400">
                갱신: {formatDateTime(generatedAt)}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 md:flex-row">
            <select
              value={sectionFilter}
              onChange={(event) => setSectionFilter(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">전체 담당 구역</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || !session?.accessToken}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? '불러오는 중...' : '새로고침'}
            </button>
          </div>
        </div>

        {message ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredSpaces.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            표시할 담당 주차면이 없습니다.
          </div>
        ) : (
          filteredSpaces.map((space, index) => (
            <article
              key={getSpaceId(space) || index}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(96px,auto)_auto] items-start gap-3">
                  <div className="min-w-0 text-left">
                    <p className="truncate text-xs font-medium text-slate-500">
                      {space.parkingLotName ?? '-'} / {space.sectionCode ?? space.sectionName ?? '-'}
                    </p>
                    <h2 className="mt-1 truncate text-xl font-bold text-slate-900">
                      {getSpaceCode(space)}
                    </h2>
                  </div>

                  <div className="text-center">
                    <p className="text-xs font-medium text-slate-500">주차면 유형</p>
                    <p className="mt-1 text-xs font-semibold text-slate-900">
                      {space.type ?? '-'}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {getStateLabel(space.state)}
                  </span>
                </div>
              <dl className="mt-4 grid gap-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">센서</dt>
                  <dd className="font-medium text-slate-800">{space.sensorStatus ?? '-'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">차량번호</dt>
                  <dd className="font-medium text-slate-800">
                    {space.activeSession?.plateNumber ?? space.activeSession?.vehiclePlate ?? '-'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">입차</dt>
                  <dd className="font-medium text-slate-800">
                    {formatDateTime(space.activeSession?.entryTime)}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">예상 요금</dt>
                  <dd className="font-medium text-slate-800">
                    {formatCurrency(space.activeSession?.accruedFeeAmount ?? space.activeSession?.accruedAmount)}
                  </dd>
                </div>
              </dl>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
