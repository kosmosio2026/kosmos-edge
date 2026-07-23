'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api';

type TenantStatementStatus = 'DRAFT' | 'CLOSED' | 'INVOICED' | 'PAID' | 'CANCELLED' | string;
type TenantChargeStatus = 'PENDING' | 'STATEMENT_CLOSED' | 'CANCELLED' | string;

type TenantStatement = {
  id: string;
  tenantId: string;
  tenantName: string | null;
  tenantCode: string | null;
  tenantBusinessNumber?: string | null;
  tenantRepresentative?: string | null;
  tenantContact?: string | null;
  parkingLotId: string;
  parkingLotName: string | null;
  parkingLotCode: string | null;
  managementCompanyName?: string | null;
  billingMonth: string;
  totalAmount: number;
  visitCount: number;
  status: TenantStatementStatus;
  closedAt?: string | null;
  closedByUserId?: string | null;
  memo?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type TenantCharge = {
  id: string;
  tenantId: string;
  tenantName: string | null;
  parkingSessionId: string;
  sessionNo?: string | null;
  plateNumber?: string | null;
  driverName?: string | null;
  phone?: string | null;
  sessionStatus?: string | null;
  entryTime?: string | null;
  exitTime?: string | null;
  parkingLotName?: string | null;
  parkingSpaceCode?: string | null;
  parkingSpaceNumber?: string | null;
  chargeType: string;
  amount: number;
  occurredAt: string;
  billingMonth: string;
  status: TenantChargeStatus;
  memo?: string | null;
};

type TenantStatementsPageProps = {
  scope?: 'admin' | 'manager';
};

const STATUS_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'DRAFT', label: '작성중' },
  { value: 'CLOSED', label: '마감' },
  { value: 'INVOICED', label: '청구' },
  { value: 'PAID', label: '납부완료' },
  { value: 'CANCELLED', label: '취소' },
];

function currentBillingMonth() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

function formatMoney(value: number | null | undefined) {
  return `${Number(value ?? 0).toLocaleString('ko-KR')}원`;
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');

  return `${yy}.${mm}.${dd} ${hh}:${mi}:${ss}`;
}

function statementStatusLabel(status?: string | null) {
  switch (String(status ?? '').toUpperCase()) {
    case 'DRAFT':
      return '작성중';
    case 'CLOSED':
      return '마감';
    case 'INVOICED':
      return '청구';
    case 'PAID':
      return '납부완료';
    case 'CANCELLED':
      return '취소';
    default:
      return status ?? '-';
  }
}

function chargeStatusLabel(status?: string | null) {
  switch (String(status ?? '').toUpperCase()) {
    case 'PENDING':
      return '정산대기';
    case 'STATEMENT_CLOSED':
      return '정산마감';
    case 'CANCELLED':
      return '취소';
    default:
      return status ?? '-';
  }
}

function statusBadgeClass(status?: string | null) {
  switch (String(status ?? '').toUpperCase()) {
    case 'DRAFT':
    case 'PENDING':
      return 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200';
    case 'CLOSED':
    case 'STATEMENT_CLOSED':
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200';
    case 'INVOICED':
      return 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200';
    case 'PAID':
      return 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200';
    case 'CANCELLED':
      return 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200';
    default:
      return 'bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-200';
  }
}

function buildQuery(params: Record<string, string | null | undefined>) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });

  const query = search.toString();
  return query ? `?${query}` : '';
}

export function TenantStatementsPage({ scope = 'manager' }: TenantStatementsPageProps) {
  const { session } = useAuth();
  const accessToken = session?.accessToken ?? '';
  const [billingMonth, setBillingMonth] = useState(currentBillingMonth());
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statements, setStatements] = useState<TenantStatement[]>([]);
  const [selectedStatement, setSelectedStatement] = useState<TenantStatement | null>(null);
  const [charges, setCharges] = useState<TenantCharge[]>([]);


  const summary = useMemo(() => {
    return statements.reduce(
      (acc, item) => {
        acc.totalAmount += Number(item.totalAmount ?? 0);
        acc.visitCount += Number(item.visitCount ?? 0);
        if (String(item.status).toUpperCase() === 'DRAFT') acc.draftCount += 1;
        if (String(item.status).toUpperCase() === 'CLOSED') acc.closedCount += 1;
        return acc;
      },
      {
        totalAmount: 0,
        visitCount: 0,
        draftCount: 0,
        closedCount: 0,
      },
    );
  }, [statements]);

  async function loadStatements() {
    const token = accessToken;

    if (!token) {
      setError('로그인이 필요합니다. 다시 로그인해 주세요.');
      setStatements([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const query = buildQuery({
        billingMonth,
        status,
      });

      const data = await apiFetch<TenantStatement[]>(`/tenants/billing/statements${query}`, {
        accessToken: token,
      });

      setStatements(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '입주사 정산 목록을 불러오지 못했습니다.');
      setStatements([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadCharges(statement: TenantStatement) {
    const token = accessToken;

    if (!token) {
      setError('로그인이 필요합니다. 다시 로그인해 주세요.');
      return;
    }

    setSelectedStatement(statement);
    setDetailLoading(true);
    setError(null);

    try {
      const query = buildQuery({
        billingMonth: statement.billingMonth,
        tenantId: statement.tenantId,
      });

      const data = await apiFetch<TenantCharge[]>(`/tenants/billing/charges${query}`, {
        accessToken: token,
      });

      setCharges(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '입주사 정산 상세를 불러오지 못했습니다.');
      setCharges([]);
    } finally {
      setDetailLoading(false);
    }
  }

  async function closeStatement(statement: TenantStatement) {
    const token = accessToken;

    if (!token) {
      setError('로그인이 필요합니다. 다시 로그인해 주세요.');
      return;
    }

    if (String(statement.status).toUpperCase() !== 'DRAFT') return;

    const confirmed = window.confirm(
      `${statement.tenantName ?? '입주사'} ${statement.billingMonth} 정산을 마감할까요?`,
    );

    if (!confirmed) return;

    setClosing(true);
    setError(null);

    try {
      await apiFetch(`/tenants/${statement.tenantId}/statements/${statement.id}/close`, {
        accessToken: token,
        method: 'POST',
        body: JSON.stringify({
          memo: `${statement.billingMonth} ${statement.tenantName ?? '입주사'} 방문주차 정산 마감`,
        }),
      });

      await loadStatements();

      if (selectedStatement?.id === statement.id) {
        await loadCharges(statement);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '정산 마감에 실패했습니다.');
    } finally {
      setClosing(false);
    }
  }

  useEffect(() => {
    if (!accessToken) return;
    void loadStatements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-sky-600">
                {scope === 'admin' ? 'Admin' : 'Manager'} Billing
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">입주사 정산</h1>
              <p className="mt-2 text-sm text-slate-500">
                입주사 방문주차 정산을 월별로 조회하고 DRAFT 상태의 정산을 마감합니다.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">정산월</span>
                <input
                  type="month"
                  value={billingMonth}
                  onChange={(event) => setBillingMonth(event.target.value)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">상태</span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value || 'all'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={loadStatements}
                disabled={loading}
                className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading ? '조회 중...' : '조회'}
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">총 정산금액</div>
            <div className="mt-2 text-2xl font-bold text-slate-950">{formatMoney(summary.totalAmount)}</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">방문 건수</div>
            <div className="mt-2 text-2xl font-bold text-slate-950">{summary.visitCount.toLocaleString('ko-KR')}건</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">작성중</div>
            <div className="mt-2 text-2xl font-bold text-amber-600">{summary.draftCount.toLocaleString('ko-KR')}건</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">마감</div>
            <div className="mt-2 text-2xl font-bold text-emerald-600">{summary.closedCount.toLocaleString('ko-KR')}건</div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-950">정산 목록</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">입주사</th>
                  <th className="px-5 py-3">주차장</th>
                  <th className="px-5 py-3">정산월</th>
                  <th className="px-5 py-3 text-right">방문</th>
                  <th className="px-5 py-3 text-right">정산금액</th>
                  <th className="px-5 py-3">상태</th>
                  <th className="px-5 py-3">마감일시</th>
                  <th className="px-5 py-3">작업</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {statements.map((statement) => (
                  <tr key={statement.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => loadCharges(statement)}
                        className="text-left font-semibold text-slate-950 hover:text-sky-600"
                      >
                        {statement.tenantName ?? '-'}
                      </button>
                      <div className="mt-1 text-xs text-slate-500">{statement.tenantCode ?? '-'}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-800">{statement.parkingLotName ?? '-'}</div>
                      <div className="mt-1 text-xs text-slate-500">{statement.managementCompanyName ?? '-'}</div>
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-800">{statement.billingMonth}</td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => loadCharges(statement)}
                        className="font-semibold text-sky-700 underline-offset-2 hover:underline"
                        title="방문 차량 상세 보기"
                      >
                        {Number(statement.visitCount ?? 0).toLocaleString('ko-KR')}건
                      </button>
                    </td>
                    <td className="px-5 py-4 text-right font-semibold">{formatMoney(statement.totalAmount)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(statement.status)}`}>
                        {statementStatusLabel(statement.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{formatDateTime(statement.closedAt)}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => loadCharges(statement)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          상세
                        </button>
                        {String(statement.status).toUpperCase() === 'DRAFT' ? (
                          <button
                            type="button"
                            onClick={() => closeStatement(statement)}
                            disabled={closing}
                            className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            마감
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}

                {!loading && statements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-sm text-slate-500">
                      조회된 입주사 정산이 없습니다.
                    </td>
                  </tr>
                ) : null}

                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-sm text-slate-500">
                      불러오는 중입니다...
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        {selectedStatement ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="입주사 방문 상세 내역"
          >
            <div className="flex max-h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
              <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-sky-600">방문 상세</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-950">
                    {selectedStatement.tenantName ?? '-'} 방문 차량 내역
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedStatement.billingMonth} · {selectedStatement.parkingLotName ?? '-'} · 방문 {Number(
                      selectedStatement.visitCount ?? 0,
                    ).toLocaleString('ko-KR')}건
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="rounded-2xl bg-slate-50 px-4 py-2 text-right">
                    <div className="text-xs text-slate-500">정산금액</div>
                    <div className="text-base font-bold text-slate-950">
                      {formatMoney(selectedStatement.totalAmount)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStatement(null);
                      setCharges([]);
                    }}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    닫기
                  </button>
                </div>
              </div>

              <div className="overflow-auto p-6">
                <table className="w-full min-w-[1180px] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">차량번호</th>
                      <th className="px-4 py-3">연락처</th>
                      <th className="px-4 py-3">주차면</th>
                      <th className="px-4 py-3">입차시각</th>
                      <th className="px-4 py-3">출차시각</th>
                      <th className="px-4 py-3">세션상태</th>
                      <th className="px-4 py-3 text-right">금액</th>
                      <th className="px-4 py-3">정산상태</th>
                      <th className="px-4 py-3">메모</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {charges.map((charge) => (
                      <tr key={charge.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-950">{charge.plateNumber ?? '-'}</div>
                          {charge.driverName ? (
                            <div className="mt-1 text-xs text-slate-500">{charge.driverName}</div>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">{charge.phone ?? '-'}</td>
                        <td className="px-4 py-3">{charge.parkingSpaceCode ?? charge.parkingSpaceNumber ?? '-'}</td>
                        <td className="px-4 py-3">{formatDateTime(charge.entryTime)}</td>
                        <td className="px-4 py-3">{formatDateTime(charge.exitTime)}</td>
                        <td className="px-4 py-3">{charge.sessionStatus ?? '-'}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatMoney(charge.amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(
                            charge.status,
                          )}`}>
                            {chargeStatusLabel(charge.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{charge.memo ?? '-'}</td>
                      </tr>
                    ))}

                    {!detailLoading && charges.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                          상세 내역이 없습니다.
                        </td>
                      </tr>
                    ) : null}

                    {detailLoading ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">
                          상세 내역을 불러오는 중입니다...
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 text-xs text-slate-500">
                방문 확인으로 처리된 주차요금은 입주사 월별 정산에 포함됩니다. 정산 마감 후에는 해당 월 내역을 수정할 수 없습니다.
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
