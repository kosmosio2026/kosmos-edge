'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';
import type { ConsoleRole } from '@/lib/console-role';

type Props = {
  role?: ConsoleRole;
};

type EnforcementItem = {
  id: string;
  sessionNo?: string | null;
  status?: string | null;
  entryTime?: string | null;
  elapsedMinutes?: number | null;
  isRegistered?: boolean | null;
  plateNumber?: string | null;
  contactNumber?: string | null;
  unpaidFee?: number | null;
  violationReason?: string | null;
  parkingSpace?: {
    id?: string | null;
    code?: string | null;
    status?: string | null;
    section?: {
      id?: string | null;
      name?: string | null;
      parkingLot?: {
        id?: string | null;
        name?: string | null;
        code?: string | null;
      } | null;
    } | null;
  } | null;
};

function unwrapItems<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value;

  if (value && typeof value === 'object') {
    const obj = value as {
      data?: unknown;
      items?: unknown;
    };

    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
  }

  return [];
}

function formatDate(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function formatCurrency(value?: number | null) {
  return `₩${Number(value ?? 0).toLocaleString()}`;
}

function formatElapsed(minutes?: number | null) {
  if (minutes === null || minutes === undefined) return '-';

  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return `${hours}h ${rest}m`;
}

function getParkingLotName(item: EnforcementItem) {
  return (
    item.parkingSpace?.section?.parkingLot?.name ??
    item.parkingSpace?.section?.parkingLot?.code ??
    '-'
  );
}

function getSectionName(item: EnforcementItem) {
  return item.parkingSpace?.section?.name ?? '-';
}

function getSpaceCode(item: EnforcementItem) {
  return item.parkingSpace?.code ?? '-';
}

export default function EnforcementPage({ role = 'admin' }: Props) {
  const { session } = useAuth();

  const [items, setItems] = useState<EnforcementItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [plateNumber, setPlateNumber] = useState<Record<string, string>>({});
  const [contactNumber, setContactNumber] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canRegister =
    role === 'admin' || role === 'manager' || role === 'operator';

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const result = await apiFetch('/enforcement/unregistered-overstay', {
        accessToken: session.accessToken,
      });

      setItems(unwrapItems<EnforcementItem>(result));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to load enforcement targets.',
      );
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function registerSession(item: EnforcementItem) {
    if (!session?.accessToken || !canRegister) return;

    const plate = plateNumber[item.id]?.trim() ?? '';
    const contact = contactNumber[item.id]?.trim() ?? '';

    if (!plate && !contact) {
      setError('Plate number or contact number is required.');
      return;
    }

    setRegisteringId(item.id);
    setError(null);
    setNotice(null);

    try {
      await apiFetch(`/parking-sessions/${item.id}/register`, {
        method: 'PATCH',
        accessToken: session.accessToken,
        body: JSON.stringify({
          plateNumber: plate || null,
          contactNumber: contact || null,
        }),
      });

      setNotice(`Session ${item.sessionNo ?? item.id} registered.`);
      await load();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to register session.',
      );
    } finally {
      setRegisteringId(null);
    }
  }

  const oldest = items[0];

  return (
    <main className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Enforcement
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            입차 후 10분이 지나도록 주차 등록이 되지 않은 차량을 확인하고
            등록 처리합니다.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          className="rounded-2xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">Unregistered Over 10 Min</div>
          <div className="mt-2 text-3xl font-semibold">{items.length}</div>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">Oldest Target</div>
          <div className="mt-2 text-lg font-semibold">
            {oldest ? formatElapsed(oldest.elapsedMinutes) : '-'}
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">Unpaid Fee Total</div>
          <div className="mt-2 text-lg font-semibold">
            {formatCurrency(
              items.reduce((sum, item) => sum + Number(item.unpaidFee ?? 0), 0),
            )}
          </div>
        </div>
      </section>

      <section className="overflow-x-auto rounded-3xl border bg-white">
        <table className="w-full min-w-[1200px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">번호</th>
              <th className="px-4 py-3">세션</th>
              <th className="px-4 py-3">주차장</th>
              <th className="px-4 py-3">구역</th>
              <th className="px-4 py-3">주차면</th>
              <th className="px-4 py-3">입차일시</th>
              <th className="px-4 py-3">경과시간</th>
              <th className="px-4 py-3">차량번호</th>
              <th className="px-4 py-3">연락처</th>
              <th className="px-4 py-3">Unpaid Fee</th>
              <th className="px-4 py-3">사유</th>
              <th className="px-4 py-3">주차 등록</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={12}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  No unregistered vehicles over 10 minutes.
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.id} className="border-t align-top">
                  <td className="px-4 py-3">{index + 1}</td>
                  <td className="px-4 py-3">{item.sessionNo ?? item.id}</td>
                  <td className="px-4 py-3">{getParkingLotName(item)}</td>
                  <td className="px-4 py-3">{getSectionName(item)}</td>
                  <td className="px-4 py-3">{getSpaceCode(item)}</td>
                  <td className="px-4 py-3">{formatDate(item.entryTime)}</td>
                  <td className="px-4 py-3 font-semibold text-red-600">
                    {formatElapsed(item.elapsedMinutes)}
                  </td>
                  <td className="px-4 py-3">{item.plateNumber ?? '-'}</td>
                  <td className="px-4 py-3">{item.contactNumber ?? '-'}</td>
                  <td className="px-4 py-3">
                    {formatCurrency(item.unpaidFee)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                      {item.violationReason ?? 'UNREGISTERED'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {canRegister ? (
                      <a
                        href={`/admin/parking/sessions?filter=UNREGISTERED_OVER_10&sessionId=${encodeURIComponent(String(item.id))}&action=register`}
                        className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white hover:bg-slate-700"
                      >
                        주차 등록
                      </a>
                    ) : (
                      <span className="text-xs font-bold text-slate-400">
                        권한 없음
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
