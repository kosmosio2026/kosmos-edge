'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';

type DashboardRole = 'admin' | 'manager' | 'operator';

type LiveSpace = {
  id?: string;
  parkingSpaceId?: string;
  parkingLotId?: string;
  parkingLotName?: string;
  parkingLotCode?: string | null;
  parkingLotOperationMode?: string | null;
  operationMode?: string | null;
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
    sessionNo?: string | null;
    plateNumber?: string | null;
    vehiclePlate?: string | null;
    contactNumber?: string | null;
    contactPhone?: string | null;
    entryTime?: string | null;
    exitTime?: string | null;
    entrySource?: string | null;
    exitSource?: string | null;
    accruedFeeAmount?: number | null;
    accruedAmount?: number | null;
    paymentStatus?: string | null;
    paymentReason?: string | null;
    isRegistered?: boolean | null;
  } | null;
};

type LiveResponse = {
  ok?: boolean;
  generatedAt?: string;
  spaces?: LiveSpace[];
};

type ParkingLotGroup = {
  id: string;
  name: string;
  code: string;
  operationMode: 'SENSOR' | 'MANUAL';
  spaces: LiveSpace[];
};

type DashboardPageProps = {
  role: DashboardRole;
  title: string;
  description: string;
};

type StatCardProps = {
  title: string;
  value: number | string;
  href: string;
  description?: string;
  tone?: 'default' | 'blue' | 'red' | 'amber' | 'emerald' | 'slate';
};

function getBasePath(role: DashboardRole) {
  return `/${role}`;
}

function getSpaceId(space: LiveSpace) {
  return space.parkingSpaceId ?? space.spaceId ?? space.id ?? space.spaceCode ?? '';
}

function getSpaceCode(space: LiveSpace) {
  return space.spaceCode ?? space.code ?? space.spaceNumber ?? '-';
}

function getOperationMode(space: LiveSpace): 'SENSOR' | 'MANUAL' {
  return String(space.parkingLotOperationMode ?? space.operationMode ?? 'SENSOR').toUpperCase() ===
    'MANUAL'
    ? 'MANUAL'
    : 'SENSOR';
}

function isManualLot(space: LiveSpace) {
  return getOperationMode(space) === 'MANUAL';
}

function isManualActiveSession(space: LiveSpace) {
  return (
    isManualLot(space) &&
    String(space.activeSession?.entrySource ?? '').toUpperCase() === 'MANUAL' &&
    !space.activeSession?.exitTime
  );
}

function getState(space: LiveSpace) {
  return String(space.state ?? '').toUpperCase();
}

function isSensorEmpty(space: LiveSpace) {
  const state = getState(space);

  return (
    !isManualLot(space) &&
    !space.activeSession &&
    ['EMPTY', 'AVAILABLE', 'VACANT'].includes(state)
  );
}

function isSensorOccupied(space: LiveSpace) {
  const state = getState(space);

  return (
    !isManualLot(space) &&
    (Boolean(space.activeSession) ||
      [
        'OCCUPIED',
        'REGISTERED',
        'OCCUPIED_REGISTERED',
        'OCCUPIED_UNREGISTERED',
        'UNREGISTERED_OVERDUE',
        'PAYMENT_GRACE_EXPIRED',
        'LONG_PARKING_ALERT',
        'EXITED_UNPAID',
      ].includes(state))
  );
}

function needsSensorRegistration(space: LiveSpace) {
  const state = getState(space);

  return (
    !isManualLot(space) &&
    Boolean(space.activeSession) &&
    space.activeSession?.isRegistered !== true &&
    (state === 'OCCUPIED_UNREGISTERED' || state === 'UNREGISTERED_OVERDUE')
  );
}

function needsSensorPayment(space: LiveSpace) {
  if (isManualLot(space) || !space.activeSession) return false;

  const state = getState(space);
  const paymentStatus = String(space.activeSession.paymentStatus ?? '').toUpperCase();
  const paymentReason = String(space.activeSession.paymentReason ?? '').toUpperCase();
  const amount = Number(
    space.activeSession.accruedFeeAmount ?? space.activeSession.accruedAmount ?? 0,
  );

  return (
    amount > 0 ||
    ['UNPAID', 'PENDING', 'ACCRUING', 'ADDITIONAL_FEE_REQUIRED'].includes(paymentStatus) ||
    state.includes('PAYMENT') ||
    state.includes('EXITED_UNPAID') ||
    paymentReason.includes('EXITED_UNPAID')
  );
}

function hasSensorError(space: LiveSpace) {
  return (
    !isManualLot(space) &&
    (getState(space) === 'SENSOR_ERROR' ||
      String(space.sensorStatus ?? '').toUpperCase() === 'ERROR' ||
      String(space.sensorStatus ?? '').toUpperCase() === 'OFFLINE')
  );
}

function hasSensorAlert(space: LiveSpace) {
  const state = getState(space);

  return (
    !isManualLot(space) &&
    (needsSensorRegistration(space) ||
      needsSensorPayment(space) ||
      hasSensorError(space) ||
      state === 'LONG_PARKING_ALERT' ||
      state === 'PAYMENT_GRACE_EXPIRED' ||
      state === 'EXITED_UNPAID')
  );
}

function getDashboardSpaceLabel(space: LiveSpace) {
  if (isManualActiveSession(space)) return '입차 중';
  if (isManualLot(space)) return '입차 가능';

  const state = getState(space);

  switch (state) {
    case 'EMPTY':
      return '빈 주차면';
    case 'OCCUPIED_REGISTERED':
    case 'REGISTERED':
      return '등록 주차';
    case 'OCCUPIED_UNREGISTERED':
    case 'UNREGISTERED_OVERDUE':
      return '등록 필요';
    case 'PAYMENT_GRACE_EXPIRED':
      return '결제 후 미출차';
    case 'LONG_PARKING_ALERT':
      return '장기 주차';
    case 'EXITED_UNPAID':
      return '출차 후 미결제';
    case 'SENSOR_ERROR':
      return '센서 오류';
    default:
      return state || '-';
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('ko-KR');
}

function gridHref(
  role: DashboardRole,
  lotId: string,
  mode: 'manual' | 'sensor',
  target?: string,
) {
  const params = new URLSearchParams();
  params.set('lotId', lotId);
  params.set('mode', mode);
  if (target) params.set('target', target);

  return `${getBasePath(role)}/grid?${params.toString()}`;
}

function StatCard({
  title,
  value,
  href,
  description,
  tone = 'default',
}: StatCardProps) {
  const toneClass =
    tone === 'blue'
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : tone === 'red'
        ? 'border-red-200 bg-red-50 text-red-700'
        : tone === 'amber'
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : tone === 'emerald'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : tone === 'slate'
              ? 'border-slate-300 bg-slate-100 text-slate-800'
              : 'border-slate-200 bg-white text-slate-900';

  return (
    <Link
      href={href}
      className={[
        'block rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
        toneClass,
      ].join(' ')}
    >
      <p className="text-sm font-bold opacity-80">{title}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
      {description ? <p className="mt-2 text-xs font-medium opacity-70">{description}</p> : null}
    </Link>
  );
}

function buildParkingLotGroups(spaces: LiveSpace[]) {
  const map = new Map<string, ParkingLotGroup>();

  for (const space of spaces) {
    const id = space.parkingLotId ?? space.parkingLotCode ?? space.parkingLotName ?? 'unknown';
    const existing = map.get(id);

    if (existing) {
      existing.spaces.push(space);
      continue;
    }

    map.set(id, {
      id,
      name: space.parkingLotName ?? '미지정 주차장',
      code: space.parkingLotCode ?? '-',
      operationMode: getOperationMode(space),
      spaces: [space],
    });
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
}

function SensorParkingLotCards({ group, role }: { group: ParkingLotGroup; role: DashboardRole }) {
  const total = group.spaces.length;
  const empty = group.spaces.filter(isSensorEmpty).length;
  const occupied = group.spaces.filter(isSensorOccupied).length;
  const registration = group.spaces.filter(needsSensorRegistration).length;
  const payment = group.spaces.filter(needsSensorPayment).length;
  const sensorError = group.spaces.filter(hasSensorError).length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-black text-blue-600">센서 방식</p>
          <h2 className="text-xl font-black text-slate-950">{group.name}</h2>
          <p className="text-sm text-slate-500">
            {group.code} · 센서 점유, 등록 필요, 결제/청구, 센서 오류를 확인합니다.
          </p>
        </div>
        <Link
          href={gridHref(role, group.id, 'sensor')}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white"
        >
          전체 보기
        </Link>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-6">
        <StatCard
          title="주차면"
          value={total}
          href={gridHref(role, group.id, 'sensor')}
          description="전체 주차면"
          tone="slate"
        />
        <StatCard
          title="빈 주차면"
          value={empty}
          href={gridHref(role, group.id, 'sensor', 'empty')}
          description="센서 기준 빈면"
        />
        <StatCard
          title="입차 중"
          value={occupied}
          href={gridHref(role, group.id, 'sensor', 'occupied')}
          description="센서 점유"
          tone="blue"
        />
        <StatCard
          title="등록 필요"
          value={registration}
          href={gridHref(role, group.id, 'sensor', 'registration')}
          description="주차 등록 필요"
          tone={registration > 0 ? 'red' : 'default'}
        />
        <StatCard
          title="결제/청구"
          value={payment}
          href={gridHref(role, group.id, 'sensor', 'payment')}
          description="결제 등록 또는 청구 확인"
          tone={payment > 0 ? 'amber' : 'default'}
        />
        <StatCard
          title="센서 오류"
          value={sensorError}
          href={gridHref(role, group.id, 'sensor', 'sensor-error')}
          description="장애 확인"
          tone={sensorError > 0 ? 'red' : 'default'}
        />
      </div>
    </section>
  );
}

function ManualParkingLotCards({ group, role }: { group: ParkingLotGroup; role: DashboardRole }) {
  const total = group.spaces.length;
  const entryAvailable = group.spaces.filter((space) => !isManualActiveSession(space)).length;
  const entryActive = group.spaces.filter(isManualActiveSession).length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-black text-emerald-600">수동 방식</p>
          <h2 className="text-xl font-black text-slate-950">{group.name}</h2>
          <p className="text-sm text-slate-500">
            {group.code} · 빈 주차면은 입차 등록, 입차 중인 주차면은 출차 등록으로 처리합니다.
          </p>
        </div>
        <Link
          href={gridHref(role, group.id, 'manual')}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white"
        >
          전체 보기
        </Link>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <StatCard
          title="주차면"
          value={total}
          href={gridHref(role, group.id, 'manual')}
          description="전체 주차면"
          tone="slate"
        />
        <StatCard
          title="입차 가능"
          value={entryAvailable}
          href={gridHref(role, group.id, 'manual', 'empty')}
          description="빈 주차면"
          tone="emerald"
        />
        <StatCard
          title="입차 중"
          value={entryActive}
          href={gridHref(role, group.id, 'manual', 'manual-active')}
          description="출차 등록 필요"
          tone={entryActive > 0 ? 'blue' : 'default'}
        />
      </div>
    </section>
  );
}

export function DashboardPage({ role, title, description }: DashboardPageProps) {
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
      setMessage(error instanceof Error ? error.message : '운영 홈을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => buildParkingLotGroups(spaces), [spaces]);

  const actionSpaces = useMemo(() => {
    return spaces
      .filter((space) => {
        if (isManualLot(space)) return isManualActiveSession(space);
        return hasSensorAlert(space);
      })
      .slice(0, 20);
  }, [spaces]);

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold text-blue-600">Parking Operations</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900">{title}</h1>
            <p className="mt-2 text-sm text-slate-500">{description}</p>
            {generatedAt ? (
              <p className="mt-1 text-xs text-slate-400">갱신: {formatDateTime(generatedAt)}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`${getBasePath(role)}/grid`}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white"
            >
              그리드 보기
            </Link>
            <Link
              href={`${getBasePath(role)}/map`}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white"
            >
              지도 보기
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || !session?.accessToken}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 disabled:opacity-50"
            >
              {loading ? '불러오는 중...' : '새로고침'}
            </button>
          </div>
        </div>

        {message ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>
        ) : null}
      </section>

      {groups.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          표시할 담당 주차장이 없습니다.
        </section>
      ) : (
        groups.map((group) =>
          group.operationMode === 'MANUAL' ? (
            <ManualParkingLotCards key={group.id} group={group} role={role} />
          ) : (
            <SensorParkingLotCards key={group.id} group={group} role={role} />
          ),
        )
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900">현재 처리 필요 주차면</h2>
            <p className="mt-1 text-sm text-slate-500">
              입차 중인 수동 주차면과 센서 운영 주의 항목을 우선 표시합니다.
            </p>
          </div>
          <Link
            href={`${getBasePath(role)}/grid?target=alerts`}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white"
          >
            전체 보기
          </Link>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">운영 방식</th>
                <th className="px-4 py-3">주차장</th>
                <th className="px-4 py-3">구역</th>
                <th className="px-4 py-3">주차면</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">입차 일시</th>
                <th className="px-4 py-3">차량번호</th>
                <th className="px-4 py-3">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {actionSpaces.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                    현재 처리 필요 주차면이 없습니다.
                  </td>
                </tr>
              ) : (
                actionSpaces.map((space, index) => {
                  const mode = isManualLot(space) ? 'MANUAL' : 'SENSOR';
                  const lotId =
                    space.parkingLotId ??
                    space.parkingLotCode ??
                    space.parkingLotName ??
                    'unknown';

                  const href = isManualLot(space)
                    ? gridHref(role, lotId, 'manual', 'manual-active')
                    : gridHref(
                        role,
                        lotId,
                        'sensor',
                        needsSensorRegistration(space) ? 'registration' : 'alerts',
                      );

                  return (
                    <tr key={getSpaceId(space) || index}>
                      <td className="px-4 py-3 font-black">{mode}</td>
                      <td className="px-4 py-3">{space.parkingLotName ?? '-'}</td>
                      <td className="px-4 py-3">{space.sectionCode ?? space.sectionName ?? '-'}</td>
                      <td className="px-4 py-3">{getSpaceCode(space)}</td>
                      <td className="px-4 py-3">{getDashboardSpaceLabel(space)}</td>
                      <td className="px-4 py-3">{formatDateTime(space.activeSession?.entryTime)}</td>
                      <td className="px-4 py-3">
                        {space.activeSession?.plateNumber ??
                          space.activeSession?.vehiclePlate ??
                          '-'}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={href}
                          className="inline-flex rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white"
                        >
                          처리 화면
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export default DashboardPage;
