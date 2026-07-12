'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';
import type { ConsoleRole } from '@/lib/console-role';
import { formatKstDateTime } from '@/lib/datetime';

type Props = {
  role?: ConsoleRole;
};

type OutstandingItem = {
  id: string;
  rowType?: 'INVOICE' | 'SESSION';
  invoiceNo?: string | null;
  sessionId?: string | null;
  amount?: number | null;
  paidAmount?: number | null;
  unpaidAmount?: number | null;
  unpaidFee?: number | null;
  status?: string | null;
  createdAt?: string | null;
  paidAt?: string | null;
  session?: {
    id: string;
    sessionNo?: string | null;
    plateNumber?: string | null;
    vehicleNumber?: string | null;
    unpaidAmount?: number | null;
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

function getOutstandingAmount(item: OutstandingItem) {
  return Number(
    item.unpaidFee ??
      item.unpaidAmount ??
      item.session?.unpaidAmount ??
      0,
  );
}

function getVehicleNumber(item: OutstandingItem) {
  return (
    item.session?.vehicle?.plateNumber ??
    item.session?.plateNumber ??
    item.session?.vehicleNumber ??
    '-'
  );
}

function getParkingLotName(item: OutstandingItem) {
  return (
    item.session?.parkingSpace?.section?.parkingLot?.name ??
    item.session?.parkingSpace?.section?.parkingLot?.code ??
    '-'
  );
}

function getSpaceCode(item: OutstandingItem) {
  return item.session?.parkingSpace?.code ?? '-';
}

function getUserName(item: OutstandingItem) {
  return (
    item.session?.user?.name ??
    item.session?.user?.email ??
    item.session?.user?.phone ??
    '-'
  );
}

function getDisplayNo(item: OutstandingItem) {
  if (item.invoiceNo) return item.invoiceNo;

  if (item.session?.sessionNo) {
    return `SESSION-${item.session.sessionNo}`;
  }

  if (item.sessionId) {
    return `SESSION-${item.sessionId}`;
  }

  if (item.session?.id) {
    return `SESSION-${item.session.id}`;
  }

  return item.id;
}

function getDisplayStatus(item: OutstandingItem) {
  if (item.rowType === 'SESSION') return 'UNPAID_SESSION';

  return paymentStatusLabel(item.status);
}

function getCreatedAt(item: OutstandingItem) {
  return item.createdAt ?? item.session?.entryTime ?? null;
}

export default function OutstandingPage({ role = 'admin' }: Props) {
  const { session } = useAuth();

  const [items, setItems] = useState<OutstandingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const result = await apiFetch('/billing/outstanding', {
        accessToken: session.accessToken,
      });

      setItems(unwrapList<OutstandingItem>(result));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to load outstanding invoices.',
      );
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">미납</h1>
          <p className="text-sm text-slate-500">
            Parking Live의 Unpaid Fee와 연동된 미수금 목록을 확인합니다.
          </p>
        </div>

        {role === 'operator' ? (
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

      {loading ? (
        <div className="text-sm text-slate-500">불러오는 중...</div>
      ) : null}

      <section className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">번호</th>
              <th className="px-4 py-3">Invoice / Session</th>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">주차장</th>
              <th className="px-4 py-3">주차면</th>
              <th className="px-4 py-3">Unpaid Fee</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">입차일시</th>
              <th className="px-4 py-3">생성일시</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item, index) => (
              <tr key={item.id} className="border-t">
                <td className="px-4 py-3">{index + 1}</td>

                <td className="px-4 py-3">
                  {getDisplayNo(item)}
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

                <td className="px-4 py-3 font-semibold text-red-600">
                  {formatCurrency(getOutstandingAmount(item))}
                </td>

                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                    {getDisplayStatus(item)}
                  </span>
                </td>

                <td className="px-4 py-3">
                  {formatDate(item.session?.entryTime)}
                </td>

                <td className="px-4 py-3">
                  {formatDate(getCreatedAt(item))}
                </td>
              </tr>
            ))}

            {!loading && items.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  미납 청구서가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
