'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';

const actions = [
  {
    title: '운영자 대시보드',
    description: '담당 주차장/구역의 전체 현황과 주요 알림을 확인합니다.',
    href: '/operator/dashboard',
    label: 'Dashboard',
  },
  {
    title: '주차면 현황',
    description: '담당 구역의 주차면 상태, 차량번호, 입차 시간, 예상 요금을 확인합니다.',
    href: '/operator/grid',
    label: 'Grid',
  },
  {
    title: '지도 보기',
    description: '옥외 지도 기반으로 담당 주차면 위치와 상태를 확인합니다.',
    href: '/operator/map',
    label: 'Map',
  },
  {
    title: '구역 요청',
    description: '운영자가 담당할 주차장/구역 권한을 요청합니다.',
    href: '/operator/requests/sections',
    label: 'Requests',
  },
  {
    title: '현재 주차 현황',
    description: '입차/등록/결제 상태별 주차 현황을 확인합니다.',
    href: '/operator/parking/sessions',
    label: 'Sessions',
  },
  {
    title: '미납/정산',
    description: '미납 청구서와 정산 관련 화면으로 이동합니다.',
    href: '/operator/billing',
    label: 'Billing',
  },
];

type ParkingSessionRow = {
  id: string;
  status?: string | null;
  entryTime?: string | null;
  isRegistered?: boolean | null;
  unpaidAmount?: number | null;
  unpaidFee?: number | null;
  latestSensorData?: any;
};

type RequestItem = {
  id: string;
  status?: string | null;
};

type RecentEvent = {
  id: string;
  type: string;
  source?: string | null;
  payload?: any;
  createdAt?: string | null;
  session?: {
    id?: string | null;
    sessionNo?: string | null;
    plateNumber?: string | null;
    contactPhone?: string | null;
    parkingLotName?: string | null;
    sectionName?: string | null;
    parkingSpaceCode?: string | null;
  } | null;
};

function unwrapRows(payload: unknown): ParkingSessionRow[] {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === 'object') {
    const obj = payload as {
      data?: unknown;
      items?: unknown;
      rows?: unknown;
    };

    if (Array.isArray(obj.data)) return obj.data as ParkingSessionRow[];
    if (Array.isArray(obj.items)) return obj.items as ParkingSessionRow[];
    if (Array.isArray(obj.rows)) return obj.rows as ParkingSessionRow[];
  }

  return [];
}

function elapsedMinutes(row: ParkingSessionRow) {
  if (!row.entryTime) return null;

  const date = new Date(row.entryTime);
  if (Number.isNaN(date.getTime())) return null;

  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
}

function isRegistrationNeeded(row: ParkingSessionRow) {
  return row.status === 'ACTIVE' && !row.isRegistered && Number(elapsedMinutes(row) ?? 0) >= 10;
}

function isOutstanding(row: ParkingSessionRow) {
  return Number(row.unpaidFee ?? row.unpaidAmount ?? 0) > 0;
}

function isSensorFault(row: ParkingSessionRow) {
  const deviceStatus = row.latestSensorData?.device_status;
  return deviceStatus === 2 || deviceStatus === 'FAULT' || deviceStatus === 'Fault';
}

function formatEventDate(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getRecentEventLabel(type: string) {
  if (type === 'parking.session.manual_registered') return '주차 등록';
  if (type === 'parking.session.manual_payment_registered') return '수동 결제';
  if (type === 'parking.session.registration_photo_added') return '사진 등록';
  return type;
}

export default function OperatorHomePage() {
  const { session } = useAuth();

  const [rows, setRows] = useState<ParkingSessionRow[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [showRecentEvents, setShowRecentEvents] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const [sessionResult, requestResult, recentEventResult] = await Promise.all([
        apiFetch('/parking-sessions?status=ACTIVE', {
          accessToken: session.accessToken,
        }),
        apiFetch<RequestItem[]>('/approval/operator/section-requests/my', {
          accessToken: session.accessToken,
        }),
        apiFetch('/parking-sessions/recent-events?limit=8', {
          accessToken: session.accessToken,
        }),
      ]);

      setRows(unwrapRows(sessionResult));
      setRequests(Array.isArray(requestResult) ? requestResult : unwrapRows(requestResult) as RequestItem[]);
      setRecentEvents(unwrapRows(recentEventResult) as RecentEvent[]);
    } catch (error) {
      setError(error instanceof Error ? error.message : '오늘 처리할 업무를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const workSummary = useMemo(() => {
    const active = rows.filter((row) => row.status === 'ACTIVE').length;
    const registrationNeeded = rows.filter(isRegistrationNeeded).length;
    const outstanding = rows.filter(isOutstanding).length;
    const sensorFault = rows.filter(isSensorFault).length;
    const pendingRequests = requests.filter((request) =>
      String(request.status ?? '').toUpperCase().includes('PENDING'),
    ).length;

    return {
      active,
      registrationNeeded,
      outstanding,
      sensorFault,
      pendingRequests,
    };
  }, [rows, requests]);

  const priorityWork = useMemo(() => {
    if (workSummary.registrationNeeded > 0) {
      return {
        title: '등록 필요 주차를 먼저 처리하세요',
        description: `${workSummary.registrationNeeded}건의 미등록 10분 초과 세션이 있습니다. 차량번호, 연락처, 차량 사진을 등록하세요.`,
        href: '/operator/parking/sessions?filter=UNREGISTERED_OVER_10',
        tone: 'red',
      };
    }

    if (workSummary.outstanding > 0) {
      return {
        title: '미결제 주차을 확인하세요',
        description: `${workSummary.outstanding}건의 미결제 주차이 있습니다. 현장 카드/현금/이체 수금 내역을 등록하세요.`,
        href: '/operator/parking/sessions?filter=OUTSTANDING',
        tone: 'amber',
      };
    }

    if (workSummary.sensorFault > 0) {
      return {
        title: '센서 이상을 점검하세요',
        description: `${workSummary.sensorFault}건의 센서 이상이 있습니다. 주차면 현황에서 센서 상태를 확인하세요.`,
        href: '/operator/grid',
        tone: 'purple',
      };
    }

    if (workSummary.pendingRequests > 0) {
      return {
        title: '구역 요청 승인 상태를 확인하세요',
        description: `${workSummary.pendingRequests}건의 승인 대기 요청이 있습니다.`,
        href: '/operator/requests/sections',
        tone: 'blue',
      };
    }

    return {
      title: '처리할 긴급 업무가 없습니다',
      description: '현재 등록 필요, 미결제, 센서 이상 업무가 없습니다. 필요하면 주차 현황을 새로고침하세요.',
      href: '/operator/parking/sessions?filter=ACTIVE',
      tone: 'slate',
    };
  }, [workSummary]);

  const workItems = [
    {
      title: '등록 필요',
      value: workSummary.registrationNeeded,
      description: '입차 후 10분 초과 미등록 세션',
      href: '/operator/parking/sessions?filter=UNREGISTERED_OVER_10',
      tone: workSummary.registrationNeeded > 0 ? 'red' : 'slate',
    },
    {
      title: '미결제',
      value: workSummary.outstanding,
      description: '수동 결제 등록이 필요한 세션',
      href: '/operator/parking/sessions?filter=OUTSTANDING',
      tone: workSummary.outstanding > 0 ? 'amber' : 'slate',
    },
    {
      title: '센서 이상',
      value: workSummary.sensorFault,
      description: '센서 오류 또는 점검 필요',
      href: '/operator/grid',
      tone: workSummary.sensorFault > 0 ? 'purple' : 'slate',
    },
    {
      title: '구역 요청',
      value: workSummary.pendingRequests,
      description: '승인 대기 중인 담당 구역 요청',
      href: '/operator/requests/sections',
      tone: workSummary.pendingRequests > 0 ? 'blue' : 'slate',
    },
    {
      title: '활성 주차',
      value: workSummary.active,
      description: '현재 진행 중인 주차 현황',
      href: '/operator/parking/sessions?filter=ACTIVE',
      tone: 'blue',
    },
  ];

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-6 text-slate-950">
      <section className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="rounded-[2rem] bg-white p-6 shadow-2xl">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-blue-600">
            KOSMOS OPERATOR
          </p>

          <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-black text-slate-950">
                운영자 태블릿 홈
              </h1>
              <p className="mt-2 text-sm font-bold text-slate-500">
                승인받은 주차 구역만 표시됩니다. 태블릿에서 자주 쓰는 화면을 빠르게 실행합니다.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void load()}
              className="rounded-2xl bg-blue-600 px-5 py-4 text-center text-sm font-black text-white shadow-lg shadow-blue-600/20"
            >
              {loading ? '새로고침 중...' : '업무 현황 새로고침'}
            </button>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          ) : null}
        </div>

        <section className="rounded-[2rem] bg-white p-6 shadow-2xl">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                Today Work
              </p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">
                오늘 처리할 업무
              </h2>
            </div>

            <Link
              href="/operator/parking/sessions"
              className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white"
            >
              주차 현황 열기
            </Link>
          </div>

          <Link
            href={priorityWork.href}
            className={[
              'mt-5 block rounded-[1.5rem] border p-5 transition hover:-translate-y-0.5 hover:shadow-lg',
              priorityWork.tone === 'red'
                ? 'border-red-200 bg-red-50'
                : priorityWork.tone === 'amber'
                  ? 'border-amber-200 bg-amber-50'
                  : priorityWork.tone === 'purple'
                    ? 'border-purple-200 bg-purple-50'
                    : priorityWork.tone === 'blue'
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-slate-200 bg-slate-50',
            ].join(' ')}
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                  Priority
                </div>
                <div className="mt-2 text-xl font-black text-slate-950">
                  {priorityWork.title}
                </div>
                <div className="mt-1 text-sm font-bold leading-6 text-slate-500">
                  {priorityWork.description}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-950 px-5 py-3 text-center text-sm font-black text-white">
                바로 처리
              </div>
            </div>
          </Link>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {workItems.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className={[
                  'rounded-[1.5rem] border p-5 transition hover:-translate-y-0.5 hover:shadow-lg',
                  item.tone === 'red'
                    ? 'border-red-200 bg-red-50'
                    : item.tone === 'amber'
                      ? 'border-amber-200 bg-amber-50'
                      : item.tone === 'purple'
                        ? 'border-purple-200 bg-purple-50'
                        : item.tone === 'blue'
                          ? 'border-blue-200 bg-blue-50'
                          : 'border-slate-200 bg-slate-50',
                ].join(' ')}
              >
                <div className="text-sm font-black text-slate-500">
                  {item.title}
                </div>
                <div className="mt-2 text-4xl font-black text-slate-950">
                  {item.value}
                </div>
                <div className="mt-2 min-h-10 text-xs font-bold leading-5 text-slate-500">
                  {item.description}
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-6 shadow-2xl">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                Recent Activity
              </p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">
                최근 처리 이력
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setShowRecentEvents((value) => !value)}
              className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white"
            >
              {showRecentEvents ? '최근 이력 닫기' : '최근 이력 보기'}
            </button>
          </div>

          {showRecentEvents ? (
            <div className="mt-5 space-y-3">
              {recentEvents.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm font-bold text-slate-500">
                최근 처리 이력이 없습니다.
              </div>
            ) : (
              recentEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm font-black text-slate-950">
                        {getRecentEventLabel(event.type)}
                      </div>
                      <div className="mt-1 text-xs font-bold text-slate-500">
                        {[event.session?.parkingLotName, event.session?.sectionName, event.session?.parkingSpaceCode]
                          .filter(Boolean)
                          .join(' · ') || '-'}
                        {' / '}
                        {event.session?.plateNumber ?? '차량번호 없음'}
                      </div>
                    </div>

                    <div className="text-xs font-black text-slate-400">
                      {formatEventDate(event.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
            </div>
          ) : null}
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group rounded-[1.75rem] bg-white p-5 shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl"
            >
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-500">
                {action.label}
              </p>
              <h2 className="mt-3 text-2xl font-black text-slate-950">
                {action.title}
              </h2>
              <p className="mt-3 min-h-12 text-sm font-bold leading-6 text-slate-500">
                {action.description}
              </p>
              <div className="mt-5 rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white group-hover:bg-blue-600">
                열기
              </div>
            </Link>
          ))}
        </section>

        <div className="rounded-[1.75rem] bg-slate-900 p-5 text-sm font-bold leading-6 text-slate-300">
          운영자 계정은 승인된 주차장/구역 데이터만 조회합니다. 지도와 주차면 현황도 같은 권한 범위를 사용합니다.
        </div>
      </section>
    </main>
  );
}
