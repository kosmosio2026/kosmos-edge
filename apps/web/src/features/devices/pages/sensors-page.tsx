'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { useRealtime } from '@/components/providers/realtime-provider';
import { apiFetch } from '@/lib/api-client';

type Role = 'admin' | 'manager' | 'operator';

type Props = {
  role?: Role;
};

type 센서Row = {
  id: string;
  devEui?: string;
  name?: string | null;
  status?: string | null;
  battery?: number | null;
  lastSeenAt?: string | null;
  parking주차면?: {
    code?: string | null;
    section?: {
      name?: string | null;
      parkingLot?: {
        name?: string | null;
      } | null;
    } | null;
  } | null;
};

function unwrapList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (value && typeof value === 'object') {
    const obj = value as {
      items?: unknown;
      data?: unknown;
    };

    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];

    if (
      obj.data &&
      typeof obj.data === 'object' &&
      Array.isArray((obj.data as { items?: unknown }).items)
    ) {
      return (obj.data as { items: T[] }).items;
    }
  }

  return [];
}

export default function 센서Page({ role = 'admin' }: Props) {
  const { session } = useAuth();
  const { lastEvent } = useRealtime();
  const [items, setItems] = useState<센서Row[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);

    try {
      const response = await apiFetch('/devices/sensors', {
        accessToken: session.accessToken,
      });

      setItems(unwrapList<센서Row>(response));
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (
      lastEvent?.event === 'device.updated' ||
      lastEvent?.event === 'sensor.updated' ||
      lastEvent?.event === 'parking.update'
    ) {
      void load();
    }
  }, [lastEvent, load]);

  const summary = useMemo(() => {
    const total = items.length;
    const online = items.filter((item) => item.status === 'ONLINE').length;
    const offline = items.filter((item) => item.status === 'OFFLINE').length;
    const low배터리 = items.filter(
      (item) => Number(item.battery ?? 100) <= 20,
    ).length;

    return { total, online, offline, low배터리 };
  }, [items]);

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">센서</h1>
        <p className="text-sm text-slate-500">
          {role === 'admin'
            ? '전체 센서 상태, 배터리, 마지막 수신 시각을 확인합니다.'
            : '권한 범위 내 센서 상태를 확인합니다.'}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric title="Total" value={summary.total} />
        <Metric title="온라인" value={summary.online} />
        <Metric title="오프라인" value={summary.offline} />
        <Metric title="Low 배터리" value={summary.low배터리} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <div className="font-semibold text-slate-900">센서 List</div>
            <div className="text-sm text-slate-500">
              {loading ? '불러오는 중...' : `${items.length} sensors`}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            새로고침
          </button>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-5 py-3">센서</th>
              <th className="px-5 py-3">Lot</th>
              <th className="px-5 py-3">주차면</th>
              <th className="px-5 py-3">배터리</th>
              <th className="px-5 py-3">상태</th>
              <th className="px-5 py-3">최근 수신</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100">
                <td className="px-5 py-3">
                  <div className="font-medium text-slate-900">
                    {item.name ?? item.devEui ?? item.id}
                  </div>
                  <div className="text-xs text-slate-500">
                    {item.devEui ?? '-'}
                  </div>
                </td>
                <td className="px-5 py-3">
                  {item.parking주차면?.section?.parkingLot?.name ?? '-'}
                </td>
                <td className="px-5 py-3">
                  {item.parking주차면?.code ?? '-'}
                </td>
                <td className="px-5 py-3">
                  {item.battery === null || item.battery === undefined
                    ? '-'
                    : `${item.battery}%`}
                </td>
                <td className="px-5 py-3">
                  <상태Badge status={item.status ?? 'UNKNOWN'} />
                </td>
                <td className="px-5 py-3">
                  {item.lastSeenAt
                    ? new Date(item.lastSeenAt).toLocaleString()
                    : '-'}
                </td>
              </tr>
            ))}

            {items.length === 0 && !loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-10 text-center text-slate-500"
                >
                  등록된 센서가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function 상태Badge({ status }: { status: string }) {
  const tone =
    status === 'ONLINE'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'OFFLINE'
        ? 'bg-red-50 text-red-700'
        : 'bg-slate-100 text-slate-600';

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
      {status}
    </span>
  );
}