'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api';

type TenantItem = {
  id: string;
  name: string;
  code: string;
  businessNumber?: string | null;
  representative?: string | null;
  contact?: string | null;
  billingEmail?: string | null;
  memo?: string | null;
  isActive?: boolean;

  parkingLotId?: string | null;
  parkingLotName?: string | null;
  parkingLotCode?: string | null;

  managementCompanyId?: string | null;
  managementCompanyName?: string | null;
  managementCompanyCode?: string | null;

  userCount?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type TenantUsersPageProps = {
  scope?: 'admin' | 'manager';
};

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

function activeLabel(isActive?: boolean) {
  return isActive === false ? '비활성' : '활성';
}

function activeBadgeClass(isActive?: boolean) {
  return isActive === false
    ? 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200'
    : 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200';
}

export function TenantUsersPage({ scope = 'manager' }: TenantUsersPageProps) {
  const { session } = useAuth();
  const accessToken = session?.accessToken ?? '';

  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [query, setQuery] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<TenantItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredTenants = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    if (!keyword) return tenants;

    return tenants.filter((tenant) => {
      return [
        tenant.name,
        tenant.code,
        tenant.businessNumber,
        tenant.representative,
        tenant.contact,
        tenant.billingEmail,
        tenant.parkingLotName,
        tenant.managementCompanyName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [query, tenants]);

  const summary = useMemo(() => {
    return tenants.reduce(
      (acc, tenant) => {
        acc.total += 1;
        if (tenant.isActive === false) acc.inactive += 1;
        else acc.active += 1;
        return acc;
      },
      {
        total: 0,
        active: 0,
        inactive: 0,
      },
    );
  }, [tenants]);

  const loadTenants = useCallback(async () => {
    if (!accessToken) {
      setError('로그인이 필요합니다. 다시 로그인해 주세요.');
      setTenants([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<TenantItem[]>('/tenants', {
        accessToken,
      });

      setTenants(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '입주사 목록을 불러오지 못했습니다.');
      setTenants([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    void loadTenants();
  }, [accessToken, loadTenants]);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-sky-600">
                {scope === 'admin' ? 'Admin Users' : 'Manager Users'}
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">입주사 관리</h1>
              <p className="mt-2 text-sm text-slate-500">
                승인된 입주사 정보를 확인합니다. 입주사 담당자는 Tenant 앱에서 방문 차량을 확인합니다.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">검색</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="입주사명, 코드, 주차장, 연락처"
                  className="h-10 w-72 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
                />
              </label>

              <button
                type="button"
                onClick={loadTenants}
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

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">전체 입주사</div>
            <div className="mt-2 text-2xl font-bold text-slate-950">{summary.total.toLocaleString('ko-KR')}개</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">활성</div>
            <div className="mt-2 text-2xl font-bold text-emerald-600">{summary.active.toLocaleString('ko-KR')}개</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">비활성</div>
            <div className="mt-2 text-2xl font-bold text-slate-600">{summary.inactive.toLocaleString('ko-KR')}개</div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-950">입주사 목록</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">입주사</th>
                  <th className="px-5 py-3">주차장</th>
                  <th className="px-5 py-3">대표자</th>
                  <th className="px-5 py-3">연락처</th>
                  <th className="px-5 py-3">정산 이메일</th>
                  <th className="px-5 py-3">상태</th>
                  <th className="px-5 py-3">등록일시</th>
                  <th className="px-5 py-3">작업</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredTenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => setSelectedTenant(tenant)}
                        className="text-left font-semibold text-slate-950 hover:text-sky-600"
                      >
                        {tenant.name}
                      </button>
                      <div className="mt-1 text-xs text-slate-500">
                        {tenant.code}
                        {tenant.businessNumber ? ` · ${tenant.businessNumber}` : ''}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-800">{tenant.parkingLotName ?? '-'}</div>
                      <div className="mt-1 text-xs text-slate-500">{tenant.managementCompanyName ?? '-'}</div>
                    </td>
                    <td className="px-5 py-4">{tenant.representative ?? '-'}</td>
                    <td className="px-5 py-4">{tenant.contact ?? '-'}</td>
                    <td className="px-5 py-4">{tenant.billingEmail ?? '-'}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${activeBadgeClass(tenant.isActive)}`}>
                        {activeLabel(tenant.isActive)}
                      </span>
                    </td>
                    <td className="px-5 py-4">{formatDateTime(tenant.createdAt)}</td>
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => setSelectedTenant(tenant)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        상세
                      </button>
                    </td>
                  </tr>
                ))}

                {!loading && filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-sm text-slate-500">
                      조회된 입주사가 없습니다.
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

        {selectedTenant ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="입주사 상세"
          >
            <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
              <div className="shrink-0 border-b border-slate-100 px-6 py-5">
                <p className="text-sm font-semibold text-sky-600">입주사 상세</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">{selectedTenant.name}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedTenant.parkingLotName ?? '-'} · {selectedTenant.code}
                </p>
              </div>

              <div className="grid flex-1 gap-4 overflow-y-auto p-6 text-sm md:grid-cols-2">
                <Detail label="입주사명" value={selectedTenant.name} />
                <Detail label="입주사 코드" value={selectedTenant.code} />
                <Detail label="주차장" value={selectedTenant.parkingLotName ?? '-'} />
                <Detail label="관리회사" value={selectedTenant.managementCompanyName ?? '-'} />
                <Detail label="사업자번호" value={selectedTenant.businessNumber ?? '-'} />
                <Detail label="대표자" value={selectedTenant.representative ?? '-'} />
                <Detail label="연락처" value={selectedTenant.contact ?? '-'} />
                <Detail label="정산 이메일" value={selectedTenant.billingEmail ?? '-'} />
                <Detail label="상태" value={activeLabel(selectedTenant.isActive)} />
                <Detail label="등록일시" value={formatDateTime(selectedTenant.createdAt)} />
                <div className="md:col-span-2">
                  <Detail label="메모" value={selectedTenant.memo ?? '-'} />
                </div>
              </div>

              <div className="shrink-0 flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setSelectedTenant(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm font-medium text-slate-900">{value}</div>
    </div>
  );
}
