'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';
import { formatKstDateTime } from '@/lib/datetime';

type Props = {
  role?: 'admin' | 'manager' | 'operator';
};

type ParkingHistoryRow = {
  id: string;
  sessionNo?: string | null;
  plateNumber?: string | null;
  status?: string | null;
  entryTime?: string | null;
  exitTime?: string | null;
  amount?: number | null;
  paidAmount?: number | null;
  unpaidAmount?: number | null;
  unpaidFee?: number | null;
  fee?: number | null;

  parkingSpace?: {
    code?: string | null;
    status?: string | null;
    device?: {
      devEui?: string | null;
      dev_eui?: string | null;
    } | null;
  } | null;

  vehicle?: {
    plateNumber?: string | null;
  } | null;

  latestSensorData?: {
    dev_eui?: string | null;
  } | null;

  invoiceId?: string | null;
  receiptId?: string | null;
};

function normalizeRows(payload: unknown): ParkingHistoryRow[] {
  const data = payload as any;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.items)) return data.data.items;

  return [];
}

function formatMoney(value?: number | null) {
  return `₩ ${Number(value ?? 0).toLocaleString()}`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return formatKstDateTime(date);
}

function getPlateNumber(row: ParkingHistoryRow) {
  return row.vehicle?.plateNumber ?? row.plateNumber ?? '-';
}

function getSpaceCode(row: ParkingHistoryRow) {
  return row.parkingSpace?.code ?? '-';
}

function getDevEui(row: ParkingHistoryRow) {
  return (
    row.latestSensorData?.dev_eui ??
    row.parkingSpace?.device?.devEui ??
    row.parkingSpace?.device?.dev_eui ??
    '-'
  );
}

function isPaid(row: ParkingHistoryRow) {
  const paidAmount = Number(row.paidAmount ?? 0);
  const unpaidAmount = Number(row.unpaidFee ?? row.unpaidAmount ?? 0);
  const amount = Number(row.amount ?? row.fee ?? 0);

  if (paidAmount > 0 && unpaidAmount <= 0) return true;
  if (amount > 0 && paidAmount >= amount) return true;

  return false;
}

function getBasePath(role: Props['role']) {
  if (role === 'manager') return '/manager';
  if (role === 'operator') return '/operator';
  return '/admin';
}

export default function ParkingHistoryPage({ role = 'admin' }: Props) {
  const { session } = useAuth();
  const [rows, setRows] = useState<ParkingHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const pageSize = 20;

  const basePath = getBasePath(role);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/parking-sessions?status=HISTORY', {
        accessToken: session.accessToken,
      });

      setRows(normalizeRows(res));
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : '주차 이력을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page]);

  return (
    <main className="w-full max-w-none space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            주차 이력
          </h1>
          <p className="text-sm text-slate-500">
            종료된 주차 현황 이력
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          새로고침
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <Th>번호</Th>
              <Th>세션번호</Th>
              <Th>주차면</Th>
              <Th>차량번호</Th>
              <Th>DevEUI</Th>
              <Th>상태</Th>
              <Th>입차일시</Th>
              <Th>출차일시</Th>
              <Th>요금</Th>
              <Th>결제 여부</Th>
              <Th>청구서</Th>
              <Th>영수증</Th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} className="px-5 py-10 text-center text-slate-500">
                  불러오는 중...
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-5 py-10 text-center text-slate-500">
                  주차 이력이 없습니다.
                </td>
              </tr>
            ) : (
              pageRows.map((row, index) => {
                const paid = isPaid(row);
                const rowNumber = (page - 1) * pageSize + index + 1;

                return (
                  <tr key={row.id} className="border-t">
                    <Td>{rowNumber}</Td>
                    <Td>{row.sessionNo ?? '-'}</Td>
                    <Td>{getSpaceCode(row)}</Td>
                    <Td>{getPlateNumber(row)}</Td>
                    <Td>{getDevEui(row)}</Td>
                    <Td>{row.status ?? '-'}</Td>
                    <Td>{formatDate(row.entryTime)}</Td>
                    <Td>{formatDate(row.exitTime)}</Td>
                    <Td>{formatMoney(row.amount ?? row.fee ?? 0)}</Td>
                    <Td>{paid ? '예' : '아니오'}</Td>
                    <Td>
                      {!paid ? (
                        <Link
                          href={`${basePath}/billing/invoices/${row.invoiceId ?? row.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          청구서
                        </Link>
                      ) : (
                        '-'
                      )}
                    </Td>
                    <Td>
                      {paid ? (
                        <Link
                          href={`${basePath}/billing/receipts/${row.receiptId ?? row.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          영수증
                        </Link>
                      ) : (
                        '-'
                      )}
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="text-slate-500">
          Page {page} / {totalPages} · Total {rows.length}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="rounded-lg border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            className="rounded-lg border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-5 py-3 font-medium">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-5 py-3">{children}</td>;
}
