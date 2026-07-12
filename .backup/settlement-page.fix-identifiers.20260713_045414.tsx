'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';
import type { ConsoleRole } from '@/lib/console-role';
import { canManageBilling } from '@/lib/console-role';
import { formatKstDateTime } from '@/lib/datetime';

type Props = {
  role?: ConsoleRole;
};

type 정산Item = {
  id: string;
  parkingLotId?: string | null;
  business일자?: string | null;
  totalInvoice?: number | null;
  totalPaid?: number | null;
  totalRefunded?: number | null;
  totalOutstanding?: number | null;
  status?: string | null;
  closedAt?: string | null;
  createdAt?: string | null;
  parkingLot?: {
    id: string;
    name?: string | null;
    code?: string | null;
  } | null;
};

type 정산Preview = {
  ok: true;
  business일자: string;
  parkingLotId: string;
  status: string;
  totalInvoice: number;
  totalPaid: number;
  totalRefunded: number;
  totalOutstanding: number;
  invoiceCount: number;
  paidInvoiceCount: number;
  partiallyPaidInvoiceCount: number;
  unpaidInvoiceCount: number;
  additionalFeeOutstanding: number;
  parkingLot?: {
    id: string;
    name?: string | null;
    code?: string | null;
  } | null;
};

type ParkingLotOption = {
  id: string;
  name?: string | null;
  code?: string | null;
};

function unwrapList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value;

  if (value && typeof value === 'object') {
    const obj = value as { data?: unknown; items?: unknown };
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
  }

  return [];
}

function formatCurrency(value?: number | null) {
  return `₩${Number(value ?? 0).toLocaleString()}`;
}

function format일자(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return formatKstDateTime(date);
}

function get종료일day일자String() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

function getParkingLotLabel(lot: ParkingLotOption) {
  return lot.name ?? lot.code ?? lot.id;
}

export default function 정산Page({ role = 'admin' }: Props) {
  const { session } = useAuth();

  const [items, setItems] = useState<정산Item[]>([]);
  const [preview, setPreview] = useState<정산Preview | null>(null);
  const [parkingLots, setParkingLots] = useState<ParkingLotOption[]>([]);
  const [selectedParkingLotId, setSelectedParkingLotId] = useState('');
  const [business일자, setBusiness일자] = useState(get종료일day일자String());
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = useMemo(() => canManageBilling(role), [role]);

  const load정산s = useCallback(async () => {
    if (!session?.access종료일ken) return;

    setLoading(true);
    setError(null);

    try {
      const result = await apiFetch('/billing/settlement', {
        access종료일ken: session.access종료일ken,
      });

      setItems(unwrapList<정산Item>(result));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : '정산 정보를 불러오지 못했습니다.s.',
      );
    } finally {
      setLoading(false);
    }
  }, [session?.access종료일ken]);

  const loadParkingLots = useCallback(async () => {
    if (!session?.access종료일ken) return;

    try {
      const result = await apiFetch('/facilities/lots', {
        access종료일ken: session.access종료일ken,
      });

      const lots = unwrapList<ParkingLotOption>(result);
      setParkingLots(lots);

      if (!selectedParkingLotId && lots[0]?.id) {
        setSelectedParkingLotId(lots[0].id);
      }
    } catch {
      setParkingLots([]);
    }
  }, [selectedParkingLotId, session?.access종료일ken]);

  const loadPreview = useCallback(async () => {
    if (!session?.access종료일ken) return;
    if (!selectedParkingLotId || !business일자) return;

    try {
      const query = new URL조회Params({
        parkingLotId: selectedParkingLotId,
        business일자,
      });

      const result = await apiFetch(`/billing/settlement/preview?${query}`, {
        access종료일ken: session.access종료일ken,
      });

      setPreview(result as 정산Preview);
    } catch {
      setPreview(null);
    }
  }, [business일자, selectedParkingLotId, session?.access종료일ken]);

  useEffect(() => {
    void load정산s();
  }, [load정산s]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  useEffect(() => {
    void loadParkingLots();
  }, [loadParkingLots]);

  const handleClose정산 = useCallback(async () => {
    if (!session?.access종료일ken) return;
    if (!canManage) return;

    if (!selectedParkingLotId || !business일자) {
      setError('Parking lot and business date are required.');
      return;
    }

    setClosing(true);
    setError(null);

    try {
      await apiFetch('/billing/settlement/close', {
        method: 'POST',
        access종료일ken: session.access종료일ken,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parkingLotId: selectedParkingLotId,
          business일자,
        }),
      });

      await load정산s();
      await loadPreview();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to close settlement.',
      );
    } finally {
      setClosing(false);
    }
  }, [
    business일자,
    canManage,
    loadPreview,
    load정산s,
    selectedParkingLotId,
    session?.access종료일ken,
  ]);

  return (
    <main className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">정산 현황</h1>
          <p className="text-sm text-slate-500">
            일별 정산 내역을 확인합니다.
          </p>
        </div>

        {!canManage ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            View only
          </span>
        ) : null}
      </div>

      <section className="rounded-2xl border bg-white p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold">정산 Filter</h2>
          <p className="text-sm text-slate-500">
            조회할 주차장과 한국 영업일을 선택합니다.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500">
              주차장
            </span>
            <select
              value={selectedParkingLotId}
              onChange={(event) => setSelectedParkingLotId(event.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            >
              {parkingLots.length === 0 ? (
                <option value="">주차장 없음</option>
              ) : null}

              {parkingLots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {getParkingLotLabel(lot)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500">
              Business 일자
            </span>
            <input
              type="date"
              value={business일자}
              onChange={(event) => setBusiness일자(event.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>

      {canManage ? (
        <section className="rounded-2xl border bg-white p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold">Close 일별 정산</h2>
            <p className="text-sm text-slate-500">
              선택한 주차장과 영업일 기준으로 일별 정산을 마감합니다.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_220px_auto]">
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500">
                주차장
              </span>
              <select
                value={selectedParkingLotId}
                onChange={(event) => setSelectedParkingLotId(event.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              >
                {parkingLots.length === 0 ? (
                  <option value="">주차장 없음</option>
                ) : null}

                {parkingLots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {getParkingLotLabel(lot)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500">
                Business 일자
              </span>
              <input
                type="date"
                value={business일자}
                onChange={(event) => setBusiness일자(event.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              />
            </label>

            <div className="flex items-end">
              <button
                type="button"
                disabled={closing || !selectedParkingLotId || !business일자}
                onClick={() => void handleClose정산()}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {closing ? 'Closing...' : 'Close'}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border bg-white p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">일별 정산 Preview</h2>
            <p className="text-sm text-slate-500">
              마감 전 현재 영업일 기준 정산 예상치를 확인합니다.
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            {preview?.status ?? 'OPEN'}
          </span>
        </div>

        {preview ? (
          <>
            <div className="mb-4 text-sm text-slate-600">
              <span className="font-semibold">
                {preview.parkingLot?.name ??
                  preview.parkingLot?.code ??
                  preview.parkingLotId}
              </span>
              <span className="mx-2">·</span>
              <span>{preview.business일자}</span>
            </div>

            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">발생요금</p>
                <p className="mt-1 text-xl font-bold">
                  {formatCurrency(preview.totalInvoice)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {preview.invoiceCount}건
                </p>
              </div>

              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-xs font-medium text-emerald-700">수납금액</p>
                <p className="mt-1 text-xl font-bold text-emerald-700">
                  {formatCurrency(preview.totalPaid)}
                </p>
                <p className="mt-1 text-xs text-emerald-700">
                  완납 {preview.paidInvoiceCount}건
                </p>
              </div>

              <div className="rounded-xl bg-red-50 p-4">
                <p className="text-xs font-medium text-red-700">미수금</p>
                <p className="mt-1 text-xl font-bold text-red-700">
                  {formatCurrency(preview.totalOutstanding)}
                </p>
                <p className="mt-1 text-xs text-red-700">
                  미납 {preview.unpaidInvoiceCount}건
                </p>
              </div>

              <div className="rounded-xl bg-amber-50 p-4">
                <p className="text-xs font-medium text-amber-700">부분결제</p>
                <p className="mt-1 text-xl font-bold text-amber-700">
                  {preview.partiallyPaidInvoiceCount}건
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  추가 확인 필요
                </p>
              </div>

              <div className="rounded-xl bg-orange-50 p-4">
                <p className="text-xs font-medium text-orange-700">
                  추가요금 미납
                </p>
                <p className="mt-1 text-xl font-bold text-orange-700">
                  {formatCurrency(preview.additionalFeeOutstanding)}
                </p>
                <p className="mt-1 text-xs text-orange-700">
                  유예 초과 출차
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-500">환불금액</p>
                <p className="mt-1 text-xl font-bold">
                  {formatCurrency(preview.totalRefunded)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  환불 처리분
                </p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">
            주차장과 영업일을 선택하면 정산 예상치가 표시됩니다.
          </p>
        )}
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-slate-500">불러오는 중...</div>
      ) : null}

      <section className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">번호</th>
              <th className="px-4 py-3">Business 일자</th>
              <th className="px-4 py-3">주차장</th>
              <th className="px-4 py-3">종료일tal Invoice</th>
              <th className="px-4 py-3">종료일tal Paid</th>
              <th className="px-4 py-3">종료일tal Refunded</th>
              <th className="px-4 py-3">종료일tal Outstanding</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">Closed At</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item, index) => (
              <tr key={item.id} className="border-t">
                <td className="px-4 py-3">{index + 1}</td>

                <td className="px-4 py-3">
                  {item.business일자 ?? '-'}
                </td>

                <td className="px-4 py-3">
                  {item.parkingLot?.name ??
                    item.parkingLot?.code ??
                    item.parkingLotId ??
                    '-'}
                </td>

                <td className="px-4 py-3">
                  {formatCurrency(item.totalInvoice)}
                </td>

                <td className="px-4 py-3 font-semibold text-emerald-700">
                  {formatCurrency(item.totalPaid)}
                </td>

                <td className="px-4 py-3">
                  {formatCurrency(item.totalRefunded)}
                </td>

                <td className="px-4 py-3 font-semibold text-red-600">
                  {formatCurrency(item.totalOutstanding)}
                </td>

                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {item.status ?? '-'}
                  </span>
                </td>

                <td className="px-4 py-3">
                  {format일자(item.closedAt)}
                </td>
              </tr>
            ))}

            {!loading && items.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  정산 내역이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
