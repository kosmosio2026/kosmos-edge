'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';

type Role = 'admin' | 'manager' | 'operator';

type Props = {
  role?: Role;
};

type HistoryRow = {
  id: string;
  sessionNo?: string | null;
  status?: string | null;
  entryTime?: string | null;
  exitTime?: string | null;
  plateNumber?: string | null;
  vehiclePlateNumber?: string | null;
  contactNumber?: string | null;
  contactPhone?: string | null;
  devEui?: string | null;
  deviceDevEui?: string | null;

  parkingLotName?: string | null;
  lotName?: string | null;
  sectionName?: string | null;
  sectionCode?: string | null;
  parkingSectionName?: string | null;
  parkingSectionCode?: string | null;
  parkingSpaceCode?: string | null;
  parkingSpaceNumber?: string | null;
  spaceCode?: string | null;

  amount?: number | null;
  fee?: number | null;
  billedAmount?: number | null;
  paidAmount?: number | null;
  unpaidAmount?: number | null;
  unpaidFee?: number | null;
  invoiceId?: string | null;
  invoiceNo?: string | null;
  invoiceStatus?: string | null;
  receiptId?: string | null;
  paidAt?: string | null;

  ParkingSpace?: any;
  parkingSpace?: any;
  vehicle?: any;
  sensorDevice?: any;
  latestSensorData?: any;
  latestInvoice?: any;
};

function unwrapRows(payload: unknown): HistoryRow[] {
  if (Array.isArray(payload)) return payload as HistoryRow[];

  if (payload && typeof payload === 'object') {
    const obj = payload as {
      data?: unknown;
      items?: unknown;
      rows?: unknown;
    };

    if (Array.isArray(obj.data)) return obj.data as HistoryRow[];
    if (Array.isArray(obj.items)) return obj.items as HistoryRow[];
    if (Array.isArray(obj.rows)) return obj.rows as HistoryRow[];
  }

  return [];
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value);
    }
  }

  return '-';
}

function asNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value: unknown) {
  return `₩ ${asNumber(value).toLocaleString('ko-KR')}`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDurationMinutes(minutes: number | null) {
  if (minutes === null || !Number.isFinite(minutes) || minutes < 0) return '-';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours <= 0) return `${mins}분`;
  if (mins <= 0) return `${hours}시간`;
  return `${hours}시간 ${mins}분`;
}

function getParkingMinutes(row: HistoryRow) {
  if (!row.entryTime) return null;

  const start = new Date(row.entryTime).getTime();
  const end = row.exitTime ? new Date(row.exitTime).getTime() : Date.now();

  if (Number.isNaN(start) || Number.isNaN(end)) return null;

  return Math.max(0, Math.floor((end - start) / 60000));
}

function getStatusLabel(status?: string | null) {
  const value = String(status ?? '').toUpperCase();

  if (value === 'PAID') return '결제 완료';
  if (value === 'CLOSED') return '정산 완료';
  if (value === 'ENDED') return '종료';
  if (value === 'ACTIVE') return '주차 중';
  if (value === 'REGISTERED') return '등록 완료';
  if (value === 'UNREGISTERED') return '미등록';
  if (value === 'CANCELLED' || value === 'CANCELED') return '취소';
  if (value === 'EXPIRED') return '만료';
  if (value === 'UNPAID') return '미납';
  if (value === 'PARTIALLY_PAID') return '부분 납부';

  return status ?? '-';
}

function getLotName(row: HistoryRow) {
  return firstText(
    row.parkingLotName,
    row.lotName,
    row.ParkingSpace?.section?.parkingLot?.name,
    row.parkingSpace?.section?.parkingLot?.name,
    row.latestInvoice?.parkingLotName,
  );
}

function getSectionName(row: HistoryRow) {
  return firstText(
    row.sectionName,
    row.parkingSectionName,
    row.sectionCode,
    row.parkingSectionCode,
    row.ParkingSpace?.section?.name,
    row.ParkingSpace?.section?.code,
    row.parkingSpace?.section?.name,
    row.parkingSpace?.section?.code,
  );
}

function getSpaceCode(row: HistoryRow) {
  return firstText(
    row.parkingSpaceCode,
    row.parkingSpaceNumber,
    row.spaceCode,
    row.ParkingSpace?.code,
    row.ParkingSpace?.number,
    row.parkingSpace?.code,
    row.parkingSpace?.number,
  );
}

function getPlateNumber(row: HistoryRow) {
  return firstText(row.plateNumber, row.vehiclePlateNumber, row.vehicle?.plateNumber);
}

function getDevEui(row: HistoryRow) {
  return firstText(
    row.devEui,
    row.deviceDevEui,
    row.sensorDevice?.devEui,
    row.latestSensorData?.devEui,
    row.latestSensorData?.dev_eui,
  );
}

function getBilledAmount(row: HistoryRow) {
  return asNumber(row.billedAmount ?? row.latestInvoice?.amount ?? row.amount ?? row.fee ?? 0);
}

function getPaidAmount(row: HistoryRow) {
  return asNumber(row.paidAmount ?? row.latestInvoice?.paidAmount ?? 0);
}

function getUnpaidAmount(row: HistoryRow) {
  return asNumber(row.unpaidAmount ?? row.unpaidFee ?? row.latestInvoice?.unpaidAmount ?? 0);
}

function getInvoiceId(row: HistoryRow) {
  const value = firstText(row.invoiceId, row.latestInvoice?.id);
  return value === '-' ? '' : value;
}

function getBasePath(role: Role) {
  return `/${role}`;
}

function isHistoryRow(row: HistoryRow) {
  return String(row.status ?? '').toUpperCase() !== 'ACTIVE';
}

function HistoryPage({ role = 'admin' }: Props) {
  const { session } = useAuth();

  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [selected, setSelected] = useState<HistoryRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const basePath = getBasePath(role);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError('');

    try {
      const result = await apiFetch('/parking-sessions?status=HISTORY', {
        accessToken: session.accessToken,
      });

      setRows(unwrapRows(result).filter(isHistoryRow));
    } catch (err) {
      setError(err instanceof Error ? err.message : '주차 이력을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const bTime = new Date(b.exitTime ?? b.entryTime ?? 0).getTime();
      const aTime = new Date(a.exitTime ?? a.entryTime ?? 0).getTime();
      return bTime - aTime;
    });
  }, [rows]);

  function renderDocumentLink(row: HistoryRow) {
    const invoiceId = getInvoiceId(row);
    const status = String(row.invoiceStatus ?? row.status ?? '').toUpperCase();
    const unpaidAmount = getUnpaidAmount(row);
    const paidAmount = getPaidAmount(row);

    if (!invoiceId) return '-';

    if (status === 'PAID' || (paidAmount > 0 && unpaidAmount <= 0)) {
      return (
        <Link
          href={`${basePath}/billing/receipts/${invoiceId}`}
          className="font-bold text-emerald-700 hover:underline"
        >
          영수증
        </Link>
      );
    }

    if (unpaidAmount > 0 || status !== 'PAID') {
      return (
        <Link
          href={`${basePath}/billing/invoices/${invoiceId}`}
          className="font-bold text-blue-700 hover:underline"
        >
          청구서
        </Link>
      );
    }

    return '-';
  }

  return (
    <main className="space-y-6 p-6">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-950">주차 이력</h1>
          <p className="mt-1 text-sm font-bold text-slate-500">
            종료된 주차 현황, 정산/결제 상태, 청구서와 영수증을 확인합니다.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white"
        >
          {loading ? '새로고침 중...' : '새로고침'}
        </button>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
        <table className="w-full min-w-[1500px] text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left font-black">번호</th>
              <th className="px-4 py-3 text-left font-black">주차장</th>
              <th className="px-4 py-3 text-left font-black">주차 구역</th>
              <th className="px-4 py-3 text-left font-black">주차면</th>
              <th className="px-4 py-3 text-left font-black">차량번호</th>
              <th className="px-4 py-3 text-left font-black">상태</th>
              <th className="px-4 py-3 text-left font-black">입차일시</th>
              <th className="px-4 py-3 text-left font-black">출차일시</th>
              <th className="px-4 py-3 text-left font-black">주차 시간</th>
              <th className="px-4 py-3 text-right font-black">청구 요금</th>
              <th className="px-4 py-3 text-right font-black">납부 요금</th>
              <th className="px-4 py-3 text-right font-black">미납 요금</th>
              <th className="px-4 py-3 text-left font-black">청구서/영수증</th>
            </tr>
          </thead>

          <tbody>
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-4 py-10 text-center text-sm font-bold text-slate-500">
                  주차 이력이 없습니다.
                </td>
              </tr>
            ) : (
              sortedRows.map((row, index) => {
                const parkingMinutes = getParkingMinutes(row);

                return (
                  <tr key={row.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setSelected(row)}
                        className="font-black text-blue-700 hover:underline"
                      >
                        {index + 1}
                      </button>
                    </td>
                    <td className="px-4 py-3">{getLotName(row)}</td>
                    <td className="px-4 py-3">{getSectionName(row)}</td>
                    <td className="px-4 py-3">{getSpaceCode(row)}</td>
                    <td className="px-4 py-3 font-bold">{getPlateNumber(row)}</td>
                    <td className="px-4 py-3 font-bold">{getStatusLabel(row.status)}</td>
                    <td className="px-4 py-3">{formatDate(row.entryTime)}</td>
                    <td className="px-4 py-3">{formatDate(row.exitTime)}</td>
                    <td className="px-4 py-3">{formatDurationMinutes(parkingMinutes)}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatMoney(getBilledAmount(row))}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">{formatMoney(getPaidAmount(row))}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-700">{formatMoney(getUnpaidAmount(row))}</td>
                    <td className="px-4 py-3">{renderDocumentLink(row)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-600">
                  Parking Session
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  세션 상세 정보
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700"
              >
                닫기
              </button>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border">
              <table className="w-full text-sm">
                <tbody>
                  {[
                    ['세션 ID', selected.id],
                    ['세션번호', selected.sessionNo ?? '-'],
                    ['상태', getStatusLabel(selected.status)],
                    ['주차장', getLotName(selected)],
                    ['주차 구역', getSectionName(selected)],
                    ['주차면', getSpaceCode(selected)],
                    ['차량번호', getPlateNumber(selected)],
                    ['DevEUI', getDevEui(selected)],
                    ['입차일시', formatDate(selected.entryTime)],
                    ['출차일시', formatDate(selected.exitTime)],
                    ['주차 시간', formatDurationMinutes(getParkingMinutes(selected))],
                    ['청구 요금', formatMoney(getBilledAmount(selected))],
                    ['납부 요금', formatMoney(getPaidAmount(selected))],
                    ['미납 요금', formatMoney(getUnpaidAmount(selected))],
                    ['청구서 번호', selected.invoiceNo ?? selected.latestInvoice?.invoiceNo ?? '-'],
                    ['청구서 ID', getInvoiceId(selected) || '-'],
                    ['납부일시', formatDate(selected.paidAt ?? selected.latestInvoice?.paidAt)],
                  ].map(([label, value]) => (
                    <tr key={label} className="border-b last:border-b-0">
                      <th className="w-40 bg-slate-50 px-4 py-3 text-left font-black text-slate-600">
                        {label}
                      </th>
                      <td className="px-4 py-3 text-slate-900">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export { HistoryPage };
export default HistoryPage;
