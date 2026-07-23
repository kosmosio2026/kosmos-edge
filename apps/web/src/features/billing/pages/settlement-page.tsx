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

type SettlementItem = {
  id: string;
  parkingLotId?: string | null;
  businessDate?: string | null;
  totalInvoice?: number | null;
  totalPaid?: number | null;
  totalRefunded?: number | null;
  totalOutstanding?: number | null;
  status?: string | null;
  closedAt?: string | null;
  closedByUserId?: string | null;
  createdAt?: string | null;
  parkingLot?: {
    id: string;
    name?: string | null;
    code?: string | null;
  } | null;
};

type SettlementPreview = {
  ok: true;
  businessDate: string;
  parkingLotId: string;
  status: string;
  totalInvoice: number;
  totalPaid: number;
  totalRefunded: number;
  totalOutstanding: number;
  totalReceivable: number;
  parkingFeeOutstanding: number;
  invoiceCount: number;
  paidInvoiceCount: number;
  partiallyPaidInvoiceCount: number;
  unpaidInvoiceCount: number;
  additionalFeeOutstanding: number;
  additionalFeeInvoiceCount: number;
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
  isActive?: boolean | null;
  spaceCount?: number | null;
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

function formatDateTime(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return formatKstDateTime(date);
}

function getTodayDateString() {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd}`;
}

function getCurrentYearString() {
  return String(new Date().getFullYear());
}

function getCurrentMonthString() {
  return String(new Date().getMonth() + 1).padStart(2, '0');
}

function getParkingLotLabel(lot: ParkingLotOption) {
  return lot.name ?? lot.code ?? lot.id;
}

export default function SettlementPage({ role = 'admin' }: Props) {
  const { session } = useAuth();

  const [items, setItems] = useState<SettlementItem[]>([]);
  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [parkingLots, setParkingLots] = useState<ParkingLotOption[]>([]);
  const [selectedParkingLotId, setSelectedParkingLotId] = useState('');
  const [businessDate, setBusinessDate] = useState(getTodayDateString());
  const [listParkingLotId, setListParkingLotId] = useState('');
  const [listYear, setListYear] = useState(getCurrentYearString());
  const [listMonth, setListMonth] = useState(getCurrentMonthString());
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = useMemo(() => canManageBilling(role), [role]);

  const loadSettlements = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams();

      if (listParkingLotId) query.set('parkingLotId', listParkingLotId);
      if (listYear) query.set('year', listYear);
      if (listMonth) query.set('month', listMonth);

      const endpoint = query.toString()
        ? `/billing/settlement?${query}`
        : '/billing/settlement';

      const result = await apiFetch(endpoint, {
        accessToken: session.accessToken,
      });

      setItems(unwrapList<SettlementItem>(result));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : '정산 정보를 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }, [
    listMonth,
    listParkingLotId,
    listYear,
    session?.accessToken,
  ]);

  const loadParkingLots = useCallback(async () => {
    if (!session?.accessToken) return;

    try {
      const result = await apiFetch('/billing/settlement/parking-lots', {
        accessToken: session.accessToken,
      });

      const lots = unwrapList<ParkingLotOption>(result);
      setParkingLots(lots);

      if (!selectedParkingLotId && lots[0]?.id) {
        setSelectedParkingLotId(lots[0].id);
      }

      if (!listParkingLotId && lots[0]?.id) {
        setListParkingLotId(lots[0].id);
      }
    } catch {
      setParkingLots([]);
    }
  }, [listParkingLotId, selectedParkingLotId, session?.accessToken]);

  const loadPreview = useCallback(async () => {
    if (!session?.accessToken) return;
    if (!selectedParkingLotId || !businessDate) return;

    try {
      const query = new URLSearchParams({
        parkingLotId: selectedParkingLotId,
        businessDate,
      });

      const result = await apiFetch(`/billing/settlement/preview?${query}`, {
        accessToken: session.accessToken,
      });

      setPreview(result as SettlementPreview);
    } catch {
      setPreview(null);
    }
  }, [businessDate, selectedParkingLotId, session?.accessToken]);

  useEffect(() => {
    void loadSettlements();
  }, [loadSettlements]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  useEffect(() => {
    void loadParkingLots();
  }, [loadParkingLots]);

  const handleCloseSettlement = useCallback(async () => {
    if (!session?.accessToken) return;
    if (!canManage) return;

    if (!selectedParkingLotId || !businessDate) {
      setError('주차장과 영업일을 선택해 주세요.');
      return;
    }

    setClosing(true);
    setError(null);

    try {
      await apiFetch('/billing/settlement/close', {
        method: 'POST',
        accessToken: session.accessToken,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parkingLotId: selectedParkingLotId,
          businessDate,
        }),
      });

      await loadSettlements();
      await loadPreview();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : '정산 마감에 실패했습니다.',
      );
    } finally {
      setClosing(false);
    }
  }, [
    businessDate,
    canManage,
    loadPreview,
    loadSettlements,
    selectedParkingLotId,
    session?.accessToken,
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
            조회 전용
          </span>
        ) : null}
      </div>

      <section className="rounded-2xl border bg-white p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold">정산 필터</h2>
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
              영업일
            </span>
            <input
              type="date"
              value={businessDate}
              onChange={(event) => setBusinessDate(event.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>
        </div>
      </section>

      {canManage ? (
        <section className="rounded-2xl border bg-white p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold">일별 정산 마감</h2>
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
                영업일
              </span>
              <input
                type="date"
                value={businessDate}
                onChange={(event) => setBusinessDate(event.target.value)}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              />
            </label>

            <div className="flex items-end">
              <button
                type="button"
                disabled={closing || !selectedParkingLotId || !businessDate}
                onClick={() => void handleCloseSettlement()}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {closing ? '마감 처리 중...' : '마감 확정'}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border bg-white p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">일별 정산 미리보기</h2>
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
              <span>{preview.businessDate}</span>
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

      <section className="rounded-2xl border bg-white p-5">
        <div className="mb-4">
          <h2 className="text-base font-semibold">확정 정산 목록</h2>
          <p className="text-sm text-slate-500">
            마감 확정된 정산만 주차장, 년도, 월 기준으로 조회합니다.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_160px_160px]">
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500">
              주차장
            </span>
            <select
              value={listParkingLotId}
              onChange={(event) => setListParkingLotId(event.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            >
              <option value="">전체 주차장</option>
              {parkingLots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {getParkingLotLabel(lot)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500">
              년도
            </span>
            <input
              type="number"
              min="2020"
              max="2100"
              value={listYear}
              onChange={(event) => setListYear(event.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500">
              월
            </span>
            <select
              value={listMonth}
              onChange={(event) => setListMonth(event.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            >
              <option value="">전체 월</option>
              {Array.from({ length: 12 }, (_, index) => {
                const month = String(index + 1).padStart(2, '0');

                return (
                  <option key={month} value={month}>
                    {month}월
                  </option>
                );
              })}
            </select>
          </label>
        </div>
      </section>

      <section className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">번호</th>
              <th className="px-4 py-3">영업일</th>
              <th className="px-4 py-3">주차장</th>
              <th className="px-4 py-3">총 청구금액</th>
              <th className="px-4 py-3">총 수금금액</th>
              <th className="px-4 py-3">총 환불금액</th>
              <th className="px-4 py-3">총 미수금액</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">정산 마감 일시</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item, index) => (
              <tr key={item.id} className="border-t">
                <td className="px-4 py-3">{index + 1}</td>

                <td className="px-4 py-3">
                  {item.businessDate ?? '-'}
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
                  {formatDateTime(item.closedAt)}
                </td>
              </tr>
            ))}

            {!loading && items.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  확정된 정산 내역이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
