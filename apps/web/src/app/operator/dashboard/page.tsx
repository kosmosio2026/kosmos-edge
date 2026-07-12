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
  code?: string;
  state?: string;
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


function isEmptySpace(space: LiveSpace) {
  const state = String(space.state ?? '').toUpperCase();

  return (
    !space.activeSession &&
    ['EMPTY', 'AVAILABLE', 'VACANT'].includes(state)
  );
}

function isOccupiedSpace(space: LiveSpace) {
  const state = String(space.state ?? '').toUpperCase();

  return (
    Boolean(space.activeSession) ||
    [
      'OCCUPIED',
      'REGISTERED',
      'OCCUPIED_UNREGISTERED',
      'UNREGISTERED_OVERDUE',
      'PAYMENT_GRACE_EXPIRED',
      'LONG_PARKING_ALERT',
      'EXITED_UNPAID',
    ].includes(state)
  );
}

function isRegisteredSpace(space: LiveSpace) {
  const state = String(space.state ?? '').toUpperCase();

  return (
    space.activeSession?.isRegistered === true ||
    state === 'REGISTERED' ||
    (Boolean(space.activeSession) && state === 'LONG_PARKING_ALERT')
  );
}

function getStateLabel(state?: string) {
  switch (state) {
    case 'EMPTY':
      return '빈면';
    case 'OCCUPIED':
      return '등록/주차중';
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
        className="inline-flex whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white"
      >
        주차 등록
      </Link>
    );
  }

  if (isPaidAction(space)) {
    return (
      <Link
        href={getSpaceActionHref(space, 'detail')}
        className="inline-flex whitespace-nowrap rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white"
      >
        영수증
      </Link>
    );
  }

  if (shouldShowInvoiceAction(space)) {
    return (
      <Link
        href={getSpaceActionHref(space, 'payment')}
        className="inline-flex whitespace-nowrap rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white"
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

export default function OperatorDashboardPage() {
  const { session } = useAuth();

  const [spaces, setSpaces] = useState<LiveSpace[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

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
      setMessage(error instanceof Error ? error.message : '운영자 대시보드를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const lotIds = new Set<string>();
    const sectionIds = new Set<string>();
    const spaceIds = new Set<string>();

    let empty = 0;
    let occupied = 0;
    let registered = 0;
    let alerts = 0;
    let sensorErrors = 0;

    for (const space of spaces) {
      if (space.parkingLotId) lotIds.add(space.parkingLotId);
      if (space.sectionId) sectionIds.add(space.sectionId);
      const spaceId = getSpaceId(space);
      if (spaceId) spaceIds.add(spaceId);

      if (isEmptySpace(space)) empty += 1;
      if (isOccupiedSpace(space)) occupied += 1;
      if (isRegisteredSpace(space)) registered += 1;

      if (
        space.state === 'UNREGISTERED_OVERDUE' ||
        space.state === 'PAYMENT_GRACE_EXPIRED' ||
        space.state === 'LONG_PARKING_ALERT'
      ) {
        alerts += 1;
      }

      if (space.state === 'SENSOR_ERROR' || space.sensorStatus === 'ERROR' || space.sensorStatus === 'OFFLINE') {
        sensorErrors += 1;
      }
    }

    return {
      lots: lotIds.size,
      sections: sectionIds.size,
      spaces: spaceIds.size,
      empty,
      occupied,
      registered,
      alerts,
      sensorErrors,
    };
  }, [spaces]);

  const sections = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        parkingLotName: string;
        sectionCode: string;
        sectionName?: string | null;
        total: number;
        empty: number;
        occupied: number;
        registered: number;
          alerts: number;
      }
    >();

    for (const space of spaces) {
      const sectionId = space.sectionId ?? 'unknown';
      const existing =
        map.get(sectionId) ??
        {
          id: sectionId,
          parkingLotName: space.parkingLotName ?? '-',
          sectionCode: space.sectionCode ?? '-',
          sectionName: space.sectionName,
          total: 0,
          empty: 0,
          occupied: 0,
          registered: 0,
            alerts: 0,
        };

        existing.total += 1;

        if (isEmptySpace(space)) existing.empty += 1;
        if (isOccupiedSpace(space)) existing.occupied += 1;
        if (isRegisteredSpace(space)) existing.registered += 1;

        if (
          space.state === 'UNREGISTERED_OVERDUE' ||
          space.state === 'PAYMENT_GRACE_EXPIRED' ||
          space.state === 'LONG_PARKING_ALERT' ||
          space.state === 'SENSOR_ERROR'
        ) {
          existing.alerts += 1;
        }

      map.set(sectionId, existing);
    }

    return Array.from(map.values()).sort((a, b) => {
      const lotCompare = a.parkingLotName.localeCompare(b.parkingLotName, 'ko');
      if (lotCompare !== 0) return lotCompare;
      return a.sectionCode.localeCompare(b.sectionCode, 'ko');
    });
  }, [spaces]);

  const activeSpaces = useMemo(
    () =>
      spaces.filter(
        (space) =>
          space.activeSession ||
          space.state === 'OCCUPIED' ||
          space.state === 'REGISTERED' ||
          space.state === 'UNREGISTERED_OVERDUE' ||
          space.state === 'OCCUPIED_UNREGISTERED' ||
          space.state === 'PAYMENT_GRACE_EXPIRED' ||
          space.state === 'LONG_PARKING_ALERT' ||
          space.state === 'EXITED_UNPAID',
      ),
    [spaces],
  );

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">Operator Dashboard</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">운영자 대시보드</h1>
            <p className="mt-2 text-sm text-slate-500">
              승인받은 주차 구역과 해당 주차면 정보만 표시됩니다.
            </p>
            {generatedAt ? (
              <p className="mt-1 text-xs text-slate-400">
                갱신: {formatDateTime(generatedAt)}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || !session?.accessToken}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? '불러오는 중...' : '새로고침'}
          </button>
        </div>

        {message ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">담당 주차장</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{summary.lots}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">담당 주차 구역</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{summary.sections}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">담당 주차면</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{summary.spaces}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">주의 필요</p>
          <p className="mt-2 text-3xl font-bold text-red-600">{summary.alerts}</p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">빈 주차면</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.empty}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">등록/주차중</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {summary.registered}/{summary.occupied}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">센서 오류</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{summary.sensorErrors}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">전체 담당 면수</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{spaces.length}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">담당 구역 요약</h2>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">주차장</th>
                <th className="px-4 py-3">구역</th>
                <th className="px-4 py-3">총 주차면</th>
                <th className="px-4 py-3">빈면</th>
                <th className="px-4 py-3">등록/주차중</th>
                <th className="px-4 py-3">주의</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {sections.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    담당 구역이 없습니다.
                  </td>
                </tr>
              ) : (
                sections.map((section) => (
                  <tr key={section.id}>
                    <td className="px-4 py-3">{section.parkingLotName}</td>
                    <td className="px-4 py-3">
                      {section.sectionCode}
                      {section.sectionName ? ` - ${section.sectionName}` : ''}
                    </td>
                    <td className="px-4 py-3">{section.total}</td>
                    <td className="px-4 py-3">{section.empty}</td>
                    <td className="px-4 py-3">{section.registered}/{section.occupied}</td>
                    <td className="px-4 py-3">{section.alerts}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">현재 주차/주의 주차면</h2>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">주차장</th>
                <th className="px-4 py-3">구역</th>
                <th className="px-4 py-3">주차면</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">차량번호</th>
                <th className="px-4 py-3">입차</th>
                <th className="px-4 py-3">예상요금</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {activeSpaces.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    현재 주차/주의 주차면이 없습니다.
                  </td>
                </tr>
              ) : (
                activeSpaces.slice(0, 20).map((space, index) => (
                  <tr key={getSpaceId(space) || index}>
                    <td className="px-4 py-3">{space.parkingLotName ?? '-'}</td>
                    <td className="px-4 py-3">
                      {space.sectionCode ?? space.sectionName ?? '-'}
                    </td>
                    <td className="px-4 py-3">{getSpaceCode(space)}</td>
                    <td className="px-4 py-3">{getStateLabel(space.state)}</td>
                    <td className="px-4 py-3">
                      {space.activeSession?.plateNumber ?? space.activeSession?.vehiclePlate ?? '-'}
                    </td>
                    <td className="px-4 py-3">
                      {formatDateTime(space.activeSession?.entryTime)}
                    </td>
                    <td className="px-4 py-3">
                      {formatCurrency(space.activeSession?.accruedFeeAmount ?? space.activeSession?.accruedAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
