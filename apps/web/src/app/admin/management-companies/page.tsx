'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PaginationBar } from '@/components/console/pagination-bar';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';
import {
  createPaginationMeta,
  getRowNumber,
  paginateClientSide,
  unwrapItems,
} from '@/lib/table-query';

type ManagementCompanyItem = {
  id: string;
  name: string;
  code: string;
  businessNumber?: string | null;
  representative?: string | null;
  contact?: string | null;
  address?: string | null;
  memo?: string | null;
  isActive?: boolean | null;
  users?: number;
  managers?: number;
  parkingLots?: number;
  tenants?: number;
  tenantApplications?: number;
  monthlyStatements?: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ParkingLotItem = {
  id: string;
  name: string;
  code: string;
  region?: string | null;
  district?: string | null;
  address?: string | null;
  contact?: string | null;
  isActive?: boolean | null;
  createdAt?: string | null;
};

type ManagerItem = {
  id: string;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  status?: string | null;
  isApproved?: boolean | null;
  roles?: string[];
  createdAt?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const pad = (num: number) => String(num).padStart(2, '0');
  return `${pad(date.getFullYear() % 100)}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function activeLabel(value?: boolean | null) {
  if (value === false) return '비활성';
  if (value === true) return '활성';
  return '-';
}

export default function AdminManagementCompaniesPage() {
  const { session, logout } = useAuth();

  const [items, setItems] = useState<ManagementCompanyItem[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<ManagementCompanyItem | null>(null);
  const [selectedPanel, setSelectedPanel] = useState<'parkingLots' | 'managers' | null>(null);
  const [parkingLots, setParkingLots] = useState<ParkingLotItem[]>([]);
  const [managers, setManagers] = useState<ManagerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [panelLoading, setPanelLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = useMemo(
    () =>
      createPaginationMeta({
        page: 1,
        pageSize: 20,
        total: items.length,
      }),
    [items.length],
  );

  const pagedItems = useMemo(
    () => paginateClientSide(items, meta.page, meta.pageSize),
    [items, meta.page, meta.pageSize],
  );

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const result = await apiFetch('/management-companies', {
        accessToken: session.accessToken,
      });

      setItems(unwrapItems<ManagementCompanyItem>(result));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : '주차장운영사 목록을 불러오지 못했습니다.';

      if (message.toLowerCase().includes('unauthorized')) {
        logout('/admin/login');
        return;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, logout]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadParkingLots = useCallback(
    async (company: ManagementCompanyItem) => {
      if (!session?.accessToken) return;

      setSelectedCompany(company);
      setSelectedPanel('parkingLots');
      setPanelLoading(true);
      setError(null);

      try {
        const result = await apiFetch(`/management-companies/${company.id}/parking-lots`, {
          accessToken: session.accessToken,
        });

        setParkingLots(unwrapItems<ParkingLotItem>(result));
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : '주차장 목록을 불러오지 못했습니다.',
        );
        setParkingLots([]);
      } finally {
        setPanelLoading(false);
      }
    },
    [session?.accessToken],
  );

  const loadManagers = useCallback(
    async (company: ManagementCompanyItem) => {
      if (!session?.accessToken) return;

      setSelectedCompany(company);
      setSelectedPanel('managers');
      setPanelLoading(true);
      setError(null);

      try {
        const result = await apiFetch(`/management-companies/${company.id}/managers`, {
          accessToken: session.accessToken,
        });

        setManagers(unwrapItems<ManagerItem>(result));
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : '매니저 목록을 불러오지 못했습니다.',
        );
        setManagers([]);
      } finally {
        setPanelLoading(false);
      }
    },
    [session?.accessToken],
  );

  function closePanel() {
    setSelectedCompany(null);
    setSelectedPanel(null);
    setParkingLots([]);
    setManagers([]);
  }

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">주차장운영사 관리</h1>
        <p className="text-sm text-slate-500">
          주차장을 운영/관리하는 회사와 연결된 주차장, 매니저, 입주사 현황을 확인합니다.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border bg-white">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <div className="font-semibold text-slate-900">주차장운영사 목록</div>
            <div className="text-sm text-slate-500">
              총 {items.length.toLocaleString()}개 운영사
            </div>
          </div>
          {loading ? <div className="text-sm text-slate-500">불러오는 중...</div> : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="whitespace-nowrap px-5 py-3">번호</th>
                <th className="whitespace-nowrap px-5 py-3">운영사명</th>
                <th className="whitespace-nowrap px-5 py-3">코드</th>
                <th className="whitespace-nowrap px-5 py-3">사업자번호</th>
                <th className="whitespace-nowrap px-5 py-3">대표자</th>
                <th className="whitespace-nowrap px-5 py-3">연락처</th>
                <th className="whitespace-nowrap px-5 py-3 text-center">주차장</th>
                <th className="whitespace-nowrap px-5 py-3 text-center">매니저</th>
                <th className="whitespace-nowrap px-5 py-3 text-center">입주사</th>
                <th className="whitespace-nowrap px-5 py-3 text-center">상태</th>
                <th className="whitespace-nowrap px-5 py-3">생성일</th>
              </tr>
            </thead>
            <tbody>
              {pagedItems.map((item, index) => (
                <tr key={item.id} className="border-t">
                  <td className="whitespace-nowrap px-5 py-3 text-slate-500">
                    {getRowNumber({
                      page: meta.page,
                      pageSize: meta.pageSize,
                      index,
                    })}
                  </td>
                  <td className="px-5 py-3">
                    <div className="font-semibold text-slate-900">{item.name}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.id}</div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3">{item.code}</td>
                  <td className="whitespace-nowrap px-5 py-3">{item.businessNumber || '-'}</td>
                  <td className="whitespace-nowrap px-5 py-3">{item.representative || '-'}</td>
                  <td className="whitespace-nowrap px-5 py-3">{item.contact || '-'}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => void loadParkingLots(item)}
                      className="font-semibold text-blue-600 hover:underline"
                    >
                      {(item.parkingLots ?? 0).toLocaleString()}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => void loadManagers(item)}
                      className="font-semibold text-blue-600 hover:underline"
                    >
                      {(item.managers ?? item.users ?? 0).toLocaleString()}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-center">
                    {(item.tenants ?? 0).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-center">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {activeLabel(item.isActive)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3">{formatDate(item.createdAt)}</td>
                </tr>
              ))}

              {!loading && pagedItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-5 py-10 text-center text-slate-500">
                    등록된 주차장운영사가 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <PaginationBar meta={meta} />
      </section>

      {selectedCompany && selectedPanel === 'parkingLots' ? (
        <section className="rounded-2xl border bg-white p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {selectedCompany.name} 주차장 목록
              </h2>
              <p className="text-sm text-slate-500">운영사 코드: {selectedCompany.code}</p>
            </div>
            <button
              type="button"
              onClick={closePanel}
              className="rounded-xl border px-3 py-2 text-sm font-semibold"
            >
              닫기
            </button>
          </div>

          {panelLoading ? <div className="text-sm text-slate-500">불러오는 중...</div> : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-5 py-3">번호</th>
                  <th className="px-5 py-3">주차장</th>
                  <th className="px-5 py-3">코드</th>
                  <th className="px-5 py-3">지역</th>
                  <th className="px-5 py-3">주소</th>
                  <th className="px-5 py-3">상태</th>
                </tr>
              </thead>
              <tbody>
                {parkingLots.map((lot, index) => (
                  <tr key={lot.id} className="border-t">
                    <td className="px-5 py-3">{index + 1}</td>
                    <td className="px-5 py-3 font-semibold">{lot.name}</td>
                    <td className="px-5 py-3">{lot.code}</td>
                    <td className="px-5 py-3">{[lot.region, lot.district].filter(Boolean).join(' ') || '-'}</td>
                    <td className="px-5 py-3">{lot.address || '-'}</td>
                    <td className="px-5 py-3">{activeLabel(lot.isActive)}</td>
                  </tr>
                ))}

                {!panelLoading && parkingLots.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                      이 운영사에 연결된 주차장이 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {selectedCompany && selectedPanel === 'managers' ? (
        <section className="rounded-2xl border bg-white p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {selectedCompany.name} 매니저 목록
              </h2>
              <p className="text-sm text-slate-500">운영사 코드: {selectedCompany.code}</p>
            </div>
            <button
              type="button"
              onClick={closePanel}
              className="rounded-xl border px-3 py-2 text-sm font-semibold"
            >
              닫기
            </button>
          </div>

          {panelLoading ? <div className="text-sm text-slate-500">불러오는 중...</div> : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-5 py-3">번호</th>
                  <th className="px-5 py-3">이름</th>
                  <th className="px-5 py-3">이메일</th>
                  <th className="px-5 py-3">전화번호</th>
                  <th className="px-5 py-3">상태</th>
                  <th className="px-5 py-3">역할</th>
                </tr>
              </thead>
              <tbody>
                {managers.map((manager, index) => (
                  <tr key={manager.id} className="border-t">
                    <td className="px-5 py-3">{index + 1}</td>
                    <td className="px-5 py-3 font-semibold">{manager.name || '-'}</td>
                    <td className="px-5 py-3">{manager.email || '-'}</td>
                    <td className="px-5 py-3">{manager.phone || '-'}</td>
                    <td className="px-5 py-3">{manager.status || '-'}</td>
                    <td className="px-5 py-3">{manager.roles?.join(', ') || '-'}</td>
                  </tr>
                ))}

                {!panelLoading && managers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                      이 운영사에 연결된 매니저가 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </main>
  );
}
