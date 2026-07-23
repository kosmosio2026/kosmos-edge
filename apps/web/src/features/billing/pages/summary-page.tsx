'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';

type Role = 'admin' | 'manager' | 'operator';

type ParkingLotOption = {
  id: string;
  name?: string | null;
  code?: string | null;
  region?: string | null;
  district?: string | null;
};

type BillingSummaryOptions = {
  regions?: string[];
  districts?: string[];
  parkingLots?: ParkingLotOption[];
};

type LotBreakdownItem = {
  parkingLotId: string;
  parkingLotName?: string | null;
  parkingLotCode?: string | null;
  region?: string | null;
  district?: string | null;
  totalAmount?: number | null;
  totalPaid?: number | null;
  totalUnpaid?: number | null;
  invoiceCount?: number | null;
  paidCount?: number | null;
};

type BillingSummary = {
  todayRevenue?: number;
  monthRevenue?: number;
  outstanding?: number | { totalOpenAmount?: number | null } | null;
  collections?: number;
  invoiceCount?: number;
  paidCount?: number;
  partiallyPaidCount?: number;
  failedCount?: number;
  invoices?: {
    totalAmount?: number | null;
    totalPaid?: number | null;
    totalUnpaid?: number | null;
  };
  payments?: {
    totalSuccessAmount?: number | null;
  };
  options?: BillingSummaryOptions;
  lotBreakdown?: LotBreakdownItem[];
  generatedAt?: string;
};

type Props = {
  role?: Role;
};

function unwrapData<T>(value: unknown, fallback: T): T {
  if (value && typeof value === 'object' && 'data' in value) {
    return ((value as { data?: T }).data ?? fallback) as T;
  }

  return (value ?? fallback) as T;
}

function getOutstandingValue(
  outstanding: BillingSummary['outstanding'],
): number {
  if (typeof outstanding === 'number') return outstanding;

  if (outstanding && typeof outstanding === 'object') {
    return outstanding.totalOpenAmount ?? 0;
  }

  return 0;
}

function getCurrentYearString() {
  return String(new Date().getFullYear());
}

function getCurrentMonthString() {
  return String(new Date().getMonth() + 1).padStart(2, '0');
}

function formatCurrency(value?: number | null) {
  return `₩ ${Number(value ?? 0).toLocaleString()}`;
}

function getParkingLotLabel(lot: ParkingLotOption) {
  return lot.name ?? lot.code ?? lot.id;
}

function getBreakdownLotLabel(item: LotBreakdownItem) {
  return item.parkingLotName ?? item.parkingLotCode ?? item.parkingLotId;
}

function buildQuery(params: Record<string, string>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }

  return query.toString();
}

export default function BillingSummaryPage({ role = 'admin' }: Props) {
  const { session } = useAuth();

  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [options, setOptions] = useState<BillingSummaryOptions>({
    regions: [],
    districts: [],
    parkingLots: [],
  });

  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [parkingLotId, setParkingLotId] = useState('');
  const [year, setYear] = useState(getCurrentYearString());
  const [month, setMonth] = useState(getCurrentMonthString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleLabel =
    role === 'admin'
      ? '전체 주차장의 수금 현황을 조회합니다.'
      : role === 'manager'
        ? '담당 주차장의 수금 현황을 조회합니다.'
        : '운영 요금 수금 현황을 조회합니다.';

  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) =>
        String(index + 1).padStart(2, '0'),
      ),
    [],
  );

  const lotBreakdown = summary?.lotBreakdown ?? [];

  const loadSummary = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const query = buildQuery({
        region,
        district,
        parkingLotId,
        year,
        month,
      });

      const response = await apiFetch(`/billing/summary?${query}`, {
        accessToken: session.accessToken,
      });

      const data = unwrapData<BillingSummary | null>(response, null);
      setSummary(data);

      if (data?.options) {
        setOptions(data.options);
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : '수금 현황을 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }, [
    district,
    month,
    parkingLotId,
    region,
    session?.accessToken,
    year,
  ]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const handleRegionChange = (value: string) => {
    setRegion(value);
    setDistrict('');
    setParkingLotId('');
  };

  const handleDistrictChange = (value: string) => {
    setDistrict(value);
    setParkingLotId('');
  };

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">수금 현황</h1>
        <p className="text-sm text-slate-500">{roleLabel}</p>
      </header>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">조회 필터</h2>
          <p className="text-sm text-slate-500">
            등록된 주차장의 지역 정보와 선택한 년월 기준으로 수금 현황을 조회합니다.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500">시도</span>
            <select
              value={region}
              onChange={(event) => handleRegionChange(event.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            >
              <option value="">전체</option>
              {(options.regions ?? []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500">
              시/군/구
            </span>
            <select
              value={district}
              onChange={(event) => handleDistrictChange(event.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            >
              <option value="">전체</option>
              {(options.districts ?? []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500">주차장</span>
            <select
              value={parkingLotId}
              onChange={(event) => setParkingLotId(event.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            >
              <option value="">전체</option>
              {(options.parkingLots ?? []).map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {getParkingLotLabel(lot)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500">년도</span>
            <input
              type="number"
              min="2020"
              max="2100"
              value={year}
              onChange={(event) => setYear(event.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500">월</span>
            <select
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            >
              {monthOptions.map((item) => (
                <option key={item} value={item}>
                  {item}월
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-slate-500">불러오는 중...</div>
      ) : null}

      <section className="grid gap-6 md:grid-cols-4">
        <Card title="금일 수금액" value={summary?.todayRevenue ?? 0} />
        <Card title="당월 수금액" value={summary?.monthRevenue ?? 0} />
        <Card
          title="미수금"
          value={getOutstandingValue(summary?.outstanding)}
        />
        <Card title="수금 합계" value={summary?.collections ?? 0} />
      </section>

      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <h2 className="mb-5 text-lg font-semibold">수금 요약</h2>

        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="청구 건수" value={summary?.invoiceCount ?? 0} />
          <Metric label="완납 건수" value={summary?.paidCount ?? 0} />
          <Metric
            label="부분 납부 건수"
            value={summary?.partiallyPaidCount ?? 0}
          />
          <Metric label="취소/무효 건수" value={summary?.failedCount ?? 0} />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Metric
            label="총 청구금액"
            value={formatCurrency(summary?.invoices?.totalAmount ?? 0)}
          />
          <Metric
            label="총 납부금액"
            value={formatCurrency(summary?.invoices?.totalPaid ?? 0)}
          />
          <Metric
            label="총 미수금액"
            value={formatCurrency(summary?.invoices?.totalUnpaid ?? 0)}
          />
        </div>

        {summary?.generatedAt ? (
          <p className="mt-5 text-xs text-slate-400">
            조회 시각: {new Date(summary.generatedAt).toLocaleString('ko-KR')}
          </p>
        ) : null}
      </section>

      <section className="overflow-x-auto rounded-3xl border bg-white shadow-sm">
        <div className="border-b px-6 py-5">
          <h2 className="text-lg font-semibold">주차장별 수금 현황</h2>
          <p className="mt-1 text-sm text-slate-500">
            선택한 조건에 해당하는 등록 주차장별 수금/미수 현황입니다.
          </p>
        </div>

        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">번호</th>
              <th className="px-4 py-3">시도</th>
              <th className="px-4 py-3">시/군/구</th>
              <th className="px-4 py-3">주차장</th>
              <th className="px-4 py-3">청구금액</th>
              <th className="px-4 py-3">수금액</th>
              <th className="px-4 py-3">미수금액</th>
              <th className="px-4 py-3">청구건수</th>
              <th className="px-4 py-3">완납건수</th>
            </tr>
          </thead>

          <tbody>
            {lotBreakdown.map((item, index) => (
              <tr key={item.parkingLotId} className="border-t">
                <td className="px-4 py-3">{index + 1}</td>
                <td className="px-4 py-3">{item.region ?? '-'}</td>
                <td className="px-4 py-3">{item.district ?? '-'}</td>
                <td className="px-4 py-3 font-medium">
                  {getBreakdownLotLabel(item)}
                </td>
                <td className="px-4 py-3">
                  {formatCurrency(item.totalAmount)}
                </td>
                <td className="px-4 py-3 font-semibold text-emerald-700">
                  {formatCurrency(item.totalPaid)}
                </td>
                <td className="px-4 py-3 font-semibold text-red-600">
                  {formatCurrency(item.totalUnpaid)}
                </td>
                <td className="px-4 py-3">{item.invoiceCount ?? 0}</td>
                <td className="px-4 py-3">{item.paidCount ?? 0}</td>
              </tr>
            ))}

            {lotBreakdown.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  조회 조건에 해당하는 주차장 수금 내역이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Card({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="rounded-3xl border bg-white p-6 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-3 text-3xl font-bold">
        {formatCurrency(Number(value ?? 0))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
