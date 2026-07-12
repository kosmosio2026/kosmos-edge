'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';

type TenantDetail = {
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
  createdAt?: string;
};

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

function roleLabel(value?: string | null) {
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

export default function AdminTenantDetailPage() {
  const params = useParams<{ tenantId: string }>();
  const tenantId = params.tenantId;

  const { session, logout } = useAuth();

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [users, setUsers] = useState<TenantUserItem[]>([]);
  const [parkingLots, setParkingLots] = useState<ParkingLotItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken || !tenantId) return;

    setLoading(true);
    setError(null);

    try {
      const [tenantResult, usersResult, lotsResult] = await Promise.all([
        apiFetch(`/tenants/${tenantId}`, {
          accessToken: session.accessToken,
        }),
        apiFetch(`/tenants/${tenantId}/users`, {
          accessToken: session.accessToken,
        }),
        apiFetch(`/tenants/${tenantId}/parking-lots`, {
          accessToken: session.accessToken,
        }),
      ]);

      setTenant(tenantResult as TenantDetail);
      setUsers(Array.isArray(usersResult) ? usersResult : []);
      setParkingLots(Array.isArray(lotsResult) ? lotsResult : []);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Tenant 상세 정보를 불러오지 못했습니다.';

      if (message.toLowerCase().includes('unauthorized')) {
        logout('/admin/login');
        return;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, tenantId, logout]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-2">
            <Link
              href="/admin/tenants"
              className="text-sm font-medium text-blue-700 hover:underline"
            >
              ← Tenant 목록으로
            </Link>
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            Tenant 상세
          </h1>
          <p className="text-sm text-slate-500">
            Tenant 기본 정보, 소속 사용자, 주차장 목록을 확인합니다.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
        >
          {loading ? '불러오는 중...' : '새로고침'}
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 text-lg font-semibold text-slate-900">
          기본 정보
        </div>

        {tenant ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <InfoCard label="Tenant명" value={tenant.name} />
            <InfoCard label="Tenant 코드" value={tenant.code} />
            <InfoCard label="소속 사용자 수" value={`${tenant.tenantUsers.toLocaleString()}명`} />
            <InfoCard label="주차장 수" value={`${tenant.parkingLots.toLocaleString()}개`} />
            <InfoCard label="생성일" value={formatDate(tenant.createdAt)} />
            <InfoCard label="수정일" value={formatDate(tenant.updatedAt)} />
          </div>
        ) : (
          <div className="text-sm text-slate-500">
            {loading ? 'Tenant 정보를 불러오는 중...' : 'Tenant 정보가 없습니다.'}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <div className="font-semibold text-slate-900">소속 사용자</div>
          <div className="mt-1 text-xs text-slate-500">
            총 {users.length.toLocaleString()}명
          </div>
        </div>

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
            {users.map((user, index) => (
              <tr key={user.id} className="border-t">
                <td className="px-5 py-3">{index + 1}</td>
                <td className="px-5 py-3 font-medium text-slate-900">
                  {user.name ?? '-'}
                </td>
                <td className="px-5 py-3">{user.email ?? '-'}</td>
                <td className="px-5 py-3">{user.phone ?? '-'}</td>
                <td className="px-5 py-3">{roleLabel(user.role)}</td>
                <td className="px-5 py-3">{statusLabel(user.status)}</td>
                <td className="px-5 py-3">{formatDate(user.createdAt)}</td>
              </tr>
            ))}

            {!loading && users.length === 0 ? (
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
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <div className="font-semibold text-slate-900">주차장 목록</div>
          <div className="mt-1 text-xs text-slate-500">
            총 {parkingLots.length.toLocaleString()}개
          </div>
        </div>

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
                  <Link
                    href={`/admin/facilities/lots?lotId=${lot.id}`}
                    className="text-blue-700 underline-offset-2 hover:underline"
                  >
                    {lot.name}
                  </Link>
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

            {!loading && parkingLots.length === 0 ? (
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
      </section>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-2 break-words text-sm font-semibold text-slate-900">
        {value}
      </div>
    </div>
  );
}
