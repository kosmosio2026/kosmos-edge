'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PaginationBar } from '@/components/console/pagination-bar';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';
import {
  createPaginationMeta,
  getRowNumber,
  paginateClientSide,
} from '@/lib/table-query';

type TenantItem = {
  id: string;
  name: string;
  code: string;
  tenantUsers: number;
  parkingLots: number;
  createdAt?: string;
  updatedAt?: string;
};

type ParkingLotItem = {
  id: string;
  name: string;
  code: string;
  region?: string | null;
  district?: string | null;
  address?: string | null;
  isActive?: boolean | null;
  sections: number;
  createdAt?: string;
  updatedAt?: string;
};

type TenantUserItem = {
  id: string;
  tenantId: string;
  userId: string;
  role: string;
  status: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  userCreatedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

function toTenantArray(value: any): TenantItem[] {
  const raw = Array.isArray(value)
    ? value
    : Array.isArray(value?.items)
      ? value.items
      : Array.isArray(value?.data)
        ? value.data
        : [];

  return raw.map((item: any) => ({
    id: item.id,
    name: item.name ?? '-',
    code: item.code ?? '-',
    tenantUsers: Number(item.tenantUsers ?? item._count?.tenantUsers ?? 0),
    parkingLots: Number(item.parkingLots ?? item._count?.parkingLots ?? 0),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

function toParkingLotArray(value: any): ParkingLotItem[] {
  const raw = Array.isArray(value)
    ? value
    : Array.isArray(value?.items)
      ? value.items
      : Array.isArray(value?.data)
        ? value.data
        : [];

  return raw.map((item: any) => ({
    id: item.id,
    name: item.name ?? '-',
    code: item.code ?? '-',
    region: item.region,
    district: item.district,
    address: item.address,
    isActive: item.isActive,
    sections: Number(item.sections ?? item._count?.sections ?? 0),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

function toTenantUserArray(value: any): TenantUserItem[] {
  const raw = Array.isArray(value)
    ? value
    : Array.isArray(value?.items)
      ? value.items
      : Array.isArray(value?.data)
        ? value.data
        : [];

  return raw.map((item: any) => ({
    id: item.id,
    tenantId: item.tenantId,
    userId: item.userId,
    role: item.role ?? '-',
    status: item.status ?? '-',
    name: item.name ?? item.user?.name ?? item.user?.fullName ?? '-',
    email: item.email ?? item.user?.email ?? '-',
    phone: item.phone ?? item.user?.phone ?? item.user?.phoneNumber ?? '-',
    userCreatedAt: item.userCreatedAt ?? item.user?.createdAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

function formatDate(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function activeLabel(value?: boolean | null) {
  if (value === true) return '활성';
  if (value === false) return '비활성';
  return '-';
}

function tenantUserRoleLabel(value?: string | null) {
  if (value === 'TENANT_OWNER') return 'Tenant 대표';
  if (value === 'MANAGER') return '매니저';
  if (value === 'OPERATOR') return '운영자';
  return value ?? '-';
}

function statusLabel(value?: string | null) {
  if (value === 'ACTIVE') return '활성';
  if (value === 'PENDING') return '대기';
  if (value === 'APPROVED') return '승인';
  if (value === 'REJECTED') return '반려';
  if (value === 'INACTIVE') return '비활성';
  return value ?? '-';
}

export default function AdminTenantsPage() {
  const { session, logout } = useAuth();

  const [items, setItems] = useState<TenantItem[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<TenantItem | null>(null);
  const [selectedPanel, setSelectedPanel] = useState<'parkingLots' | 'users' | null>(
    null,
  );
  const [parkingLots, setParkingLots] = useState<ParkingLotItem[]>([]);
  const [tenantUsers, setTenantUsers] = useState<TenantUserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [lotLoading, setLotLoading] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lotError, setLotError] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);

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
      const result = await apiFetch('/tenants', {
        accessToken: session.accessToken,
      });

      setItems(toTenantArray(result));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Tenant 목록을 불러오지 못했습니다.';

      if (message.toLowerCase().includes('unauthorized')) {
        logout('/admin/login');
        return;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, logout]);

  const loadParkingLots = useCallback(
    async (tenant: TenantItem) => {
      if (!session?.accessToken) return;

      setSelectedTenant(tenant);
      setSelectedPanel('parkingLots');
      setLotLoading(true);
      setLotError(null);
      setUserError(null);

      try {
        const result = await apiFetch(`/tenants/${tenant.id}/parking-lots`, {
          accessToken: session.accessToken,
        });

        setParkingLots(toParkingLotArray(result));
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : '주차장 목록을 불러오지 못했습니다.';

        if (message.toLowerCase().includes('unauthorized')) {
          logout('/admin/login');
          return;
        }

        setParkingLots([]);
        setLotError(message);
      } finally {
        setLotLoading(false);
      }
    },
    [session?.accessToken, logout],
  );

  const loadTenantUsers = useCallback(
    async (tenant: TenantItem) => {
      if (!session?.accessToken) return;

      setSelectedTenant(tenant);
      setSelectedPanel('users');
      setUserLoading(true);
      setUserError(null);
      setLotError(null);

      try {
        const result = await apiFetch(`/tenants/${tenant.id}/users`, {
          accessToken: session.accessToken,
        });

        setTenantUsers(toTenantUserArray(result));
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : '소속 사용자 목록을 불러오지 못했습니다.';

        if (message.toLowerCase().includes('unauthorized')) {
          logout('/admin/login');
          return;
        }

        setTenantUsers([]);
        setUserError(message);
      } finally {
        setUserLoading(false);
      }
    },
    [session?.accessToken, logout],
  );

  useEffect(() => {
    void load();
  }, [load]);

  function closePanel() {
    setSelectedTenant(null);
    setSelectedPanel(null);
    setParkingLots([]);
    setTenantUsers([]);
    setLotError(null);
    setUserError(null);
  }

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Tenant 관리</h1>
        <p className="text-sm text-slate-500">
          회사/조직 단위 Tenant와 소속 사용자 수, 주차장 수를 확인합니다.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <div className="font-semibold text-slate-900">Tenant 목록</div>
            <div className="mt-1 text-xs text-slate-500">
              총 {items.length.toLocaleString()}개 Tenant
            </div>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
          >
            {loading ? '불러오는 중...' : '새로고침'}
          </button>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-5 py-3">번호</th>
              <th className="px-5 py-3">Tenant명</th>
              <th className="px-5 py-3">Tenant 코드</th>
              <th className="px-5 py-3">소속 사용자 수</th>
              <th className="px-5 py-3">주차장 수</th>
              <th className="px-5 py-3">생성일</th>
              <th className="px-5 py-3">관리</th>
            </tr>
          </thead>

          <tbody>
            {pagedItems.map((item, index) => (
              <tr key={item.id} className="border-t">
                <td className="px-5 py-3">
                  {getRowNumber({
                    page: meta.page,
                    pageSize: meta.pageSize,
                    index,
                  })}
                </td>
                <td className="px-5 py-3 font-medium text-slate-900">
                  {item.name}
                </td>
                <td className="px-5 py-3">
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                    {item.code}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <button
                    type="button"
                    onClick={() => void loadTenantUsers(item)}
                    className="rounded-lg px-2 py-1 text-sm font-semibold text-blue-700 underline-offset-2 hover:bg-blue-50 hover:underline"
                  >
                    {item.tenantUsers.toLocaleString()}
                  </button>
                </td>
                <td className="px-5 py-3">
                  <button
                    type="button"
                    onClick={() => void loadParkingLots(item)}
                    className="rounded-lg px-2 py-1 text-sm font-semibold text-blue-700 underline-offset-2 hover:bg-blue-50 hover:underline"
                  >
                    {item.parkingLots.toLocaleString()}
                  </button>
                </td>
                <td className="px-5 py-3">{formatDate(item.createdAt)}</td>
                <td className="px-5 py-3">
                  <Link
                    href={`/admin/tenants/${item.id}`}
                    className="rounded-xl border px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    상세
                  </Link>
                </td>
              </tr>
            ))}

            {!loading && items.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-10 text-center text-slate-500"
                >
                  등록된 Tenant가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <PaginationBar meta={meta} />

      {selectedTenant && selectedPanel === 'parkingLots' ? (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <div className="font-semibold text-slate-900">
                {selectedTenant.name} 주차장 목록
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Tenant 코드: {selectedTenant.code} · 총{' '}
                {parkingLots.length.toLocaleString()}개 주차장
              </div>
            </div>

            <button
              type="button"
              onClick={closePanel}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
            >
              닫기
            </button>
          </div>

          {lotError ? (
            <div className="m-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {lotError}
            </div>
          ) : null}

          {lotLoading ? (
            <div className="px-5 py-8 text-sm text-slate-500">
              주차장 목록을 불러오는 중...
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-5 py-3">번호</th>
                  <th className="px-5 py-3">주차장명</th>
                  <th className="px-5 py-3">주차장 코드</th>
                  <th className="px-5 py-3">지역</th>
                  <th className="px-5 py-3">주소</th>
                  <th className="px-5 py-3">구역 수</th>
                  <th className="px-5 py-3">상태</th>
                  <th className="px-5 py-3">생성일</th>
                </tr>
              </thead>

              <tbody>
                {parkingLots.map((lot, index) => (
                  <tr key={lot.id} className="border-t">
                    <td className="px-5 py-3">{index + 1}</td>
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {lot.name}
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {lot.code}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {[lot.region, lot.district].filter(Boolean).join(' ') || '-'}
                    </td>
                    <td className="px-5 py-3">{lot.address ?? '-'}</td>
                    <td className="px-5 py-3">{lot.sections.toLocaleString()}</td>
                    <td className="px-5 py-3">{activeLabel(lot.isActive)}</td>
                    <td className="px-5 py-3">{formatDate(lot.createdAt)}</td>
                  </tr>
                ))}

                {!lotLoading && parkingLots.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-10 text-center text-slate-500"
                    >
                      이 Tenant에 등록된 주차장이 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </section>
      ) : null}

      {selectedTenant && selectedPanel === 'users' ? (
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <div className="font-semibold text-slate-900">
                {selectedTenant.name} 소속 사용자 목록
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Tenant 코드: {selectedTenant.code} · 총{' '}
                {tenantUsers.length.toLocaleString()}명
              </div>
            </div>

            <button
              type="button"
              onClick={closePanel}
              className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
            >
              닫기
            </button>
          </div>

          {userError ? (
            <div className="m-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {userError}
            </div>
          ) : null}

          {userLoading ? (
            <div className="px-5 py-8 text-sm text-slate-500">
              소속 사용자 목록을 불러오는 중...
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-5 py-3">번호</th>
                  <th className="px-5 py-3">이름</th>
                  <th className="px-5 py-3">이메일</th>
                  <th className="px-5 py-3">전화번호</th>
                  <th className="px-5 py-3">Tenant 역할</th>
                  <th className="px-5 py-3">상태</th>
                  <th className="px-5 py-3">소속 등록일</th>
                </tr>
              </thead>

              <tbody>
                {tenantUsers.map((user, index) => (
                  <tr key={user.id} className="border-t">
                    <td className="px-5 py-3">{index + 1}</td>
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {user.name ?? '-'}
                    </td>
                    <td className="px-5 py-3">{user.email ?? '-'}</td>
                    <td className="px-5 py-3">{user.phone ?? '-'}</td>
                    <td className="px-5 py-3">
                      {tenantUserRoleLabel(user.role)}
                    </td>
                    <td className="px-5 py-3">{statusLabel(user.status)}</td>
                    <td className="px-5 py-3">{formatDate(user.createdAt)}</td>
                  </tr>
                ))}

                {!userLoading && tenantUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-10 text-center text-slate-500"
                    >
                      이 Tenant에 등록된 소속 사용자가 없습니다.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </section>
      ) : null}
    </main>
  );
}
