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

type BillingItem = {
  id: string;
  invoiceNo?: string | null;
  amount?: number | null;
  paidAmount?: number | null;
  unpaidAmount?: number | null;
  status?: string | null;
  createdAt?: string | null;
  paidAt?: string | null;
  session?: {
    id: string;
    plateNumber?: string | null;
    vehicleNumber?: string | null;
    entryTime?: string | null;
    exitTime?: string | null;
    vehicle?: {
      id?: string | null;
      plateNumber?: string | null;
    } | null;
    user?: {
      id: string;
      name?: string | null;
      email?: string | null;
      phone?: string | null;
    } | null;
    parkingSpace?: {
      id: string;
      code?: string | null;
      section?: {
        id: string;
        name?: string | null;
        parkingLot?: {
          id: string;
          name?: string | null;
          code?: string | null;
        } | null;
      } | null;
    } | null;
  } | null;
};

type BillingSummary = {
  today?: {
    count?: number | null;
    revenue?: number | null;
    collected?: number | null;
    outstanding?: number | null;
  } | null;
  month?: {
    count?: number | null;
    revenue?: number | null;
    collected?: number | null;
    outstanding?: number | null;
  } | null;
  year?: {
    count?: number | null;
    revenue?: number | null;
    collected?: number | null;
    outstanding?: number | null;
  } | null;
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

function paymentStatusLabel(status?: string | null) {
  switch (status) {
    case 'PAID':
      return '결제완료';
    case 'PARTIALLY_PAID':
      return '부분결제';
    case 'UNPAID':
    case 'ISSUED':
      return '미납';
    case 'OVERDUE':
      return '연체';
    case 'VOID':
      return '무효';
    case 'CANCELLED':
      return '취소';
    default:
      return status ?? '-';
  }
}

function formatDate(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return formatKstDateTime(date);
}

function getPaidAmount(item: BillingItem) {
  return Number(item.paidAmount ?? 0);
}

function getVehicleNumber(item: BillingItem) {
  return (
    item.session?.vehicle?.plateNumber ??
    item.session?.plateNumber ??
    item.session?.vehicleNumber ??
    '-'
  );
}

function getUserName(item: BillingItem) {
  return (
    item.session?.user?.name ??
    item.session?.user?.email ??
    item.session?.user?.phone ??
    '-'
  );
}

function getParkingLotName(item: BillingItem) {
  return (
    item.session?.parkingSpace?.section?.parkingLot?.name ??
    item.session?.parkingSpace?.section?.parkingLot?.code ??
    '-'
  );
}

function getSpaceCode(item: BillingItem) {
  return item.session?.parkingSpace?.code ?? '-';
}

export default function BillingPage({ role = 'admin' }: Props) {
  const { session } = useAuth();

  const [items, setItems] = useState<BillingItem[]>([]);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = useMemo(() => canManageBilling(role), [role]);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const [summaryResult, listResult] = await Promise.allSettled([
        apiFetch('/billing/summary', {
          accessToken: session.accessToken,
        }),
        apiFetch('/billing', {
          accessToken: session.accessToken,
        }),
      ]);

      if (summaryResult.status === 'fulfilled') {
        setSummary(summaryResult.value as BillingSummary);
      } else {
        setSummary(null);
      }

      if (listResult.status === 'fulfilled') {
        setItems(unwrapList<BillingItem>(listResult.value));
      } else {
        setItems([]);
        setError(
          listResult.reason instanceof Error
            ? listResult.reason.message
            : 'Failed to load billing records.',
        );
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to load billing records.',
      );
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const listedPaidTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + getPaidAmount(item), 0);
  }, [items]);

  const handlePay = useCallback(
    async (invoiceId: string) => {
      if (!session?.accessToken) return;
      if (!canManage) return;

      setPayingId(invoiceId);
      setError(null);

      try {
        await apiFetch(`/billing/pay/${invoiceId}`, {
          method: 'POST',
          accessToken: session.accessToken,
        });

        await load();
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : 'Failed to pay invoice.',
        );
      } finally {
        setPayingId(null);
      }
    },
    [canManage, load, session?.accessToken],
  );

  return (
    <main className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">청구</h1>
          <p className="text-sm text-slate-500">
            수금 및 결제 완료 내역을 확인합니다.
          </p>
        </div>

        {!canManage ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            View only
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Today Collected</div>
          <div className="mt-2 text-2xl font-semibold">
            {formatCurrency(summary?.today?.collected)}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Month Collected</div>
          <div className="mt-2 text-2xl font-semibold">
            {formatCurrency(summary?.month?.collected)}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Listed Paid Total</div>
          <div className="mt-2 text-2xl font-semibold">
            {formatCurrency(listedPaidTotal)}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5">
          <div className="text-sm text-slate-500">Billing Records</div>
          <div className="mt-2 text-2xl font-semibold">{items.length}</div>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-slate-500">불러오는 중...</div>
      ) : null}

      <section className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[1150px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">번호</th>
              <th className="px-4 py-3">Invoice No</th>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">주차장</th>
              <th className="px-4 py-3">주차면</th>
              <th className="px-4 py-3">금액</th>
              <th className="px-4 py-3">Paid Amount</th>
              <th className="px-4 py-3">미납</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">Paid At</th>
              <th className="px-4 py-3">생성일시</th>
              {canManage ? <th className="px-4 py-3">관리</th> : null}
            </tr>
          </thead>

          <tbody>
            {items.map((item, index) => {
              const paidAmount = Number(item.paidAmount ?? 0);
              const unpaidAmount = Number(item.unpaidAmount ?? 0);
              const isPaid = unpaidAmount <= 0 && paidAmount > 0;

              return (
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-3">{index + 1}</td>

                  <td className="px-4 py-3">
                    {item.invoiceNo ?? item.id}
                  </td>

                  <td className="px-4 py-3">
                    {getVehicleNumber(item)}
                  </td>

                  <td className="px-4 py-3">
                    {getUserName(item)}
                  </td>

                  <td className="px-4 py-3">
                    {getParkingLotName(item)}
                  </td>

                  <td className="px-4 py-3">
                    {getSpaceCode(item)}
                  </td>

                  <td className="px-4 py-3">
                    {formatCurrency(item.amount)}
                  </td>

                  <td className="px-4 py-3 font-semibold text-emerald-700">
                    {formatCurrency(item.paidAmount)}
                  </td>

                  <td className="px-4 py-3">
                    {formatCurrency(item.unpaidAmount)}
                  </td>

                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                      {paymentStatusLabel(item.status)}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    {formatDate(item.paidAt)}
                  </td>

                  <td className="px-4 py-3">
                    {formatDate(item.createdAt)}
                  </td>

                  {canManage ? (
                    <td className="px-4 py-3">
                      {!isPaid ? (
                        <button
                          type="button"
                          disabled={payingId === item.id}
                          onClick={() => void handlePay(item.id)}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {payingId === item.id ? 'Paying...' : 'Mark Paid'}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">
                          Completed
                        </span>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}

            {!loading && items.length === 0 ? (
              <tr>
                <td
                  colSpan={canManage ? 13 : 12}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  No billing records found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
