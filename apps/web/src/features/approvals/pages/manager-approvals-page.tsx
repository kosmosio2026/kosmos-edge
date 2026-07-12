'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PaginationBar } from '@/components/console/pagination-bar';
import { useAuth } from '@/components/providers/auth-provider';
import {
  fetchManagerApprovals,
  reviewApprovalRequest,
} from '@/lib/fetchers';
import {
  createPaginationMeta,
  getRowNumber,
  paginateClientSide,
  parseTableQueryFromSearchParams,
} from '@/lib/table-query';

type ApprovalItem = {
  id: string;
  requesterId?: string;
  name?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  requestData?: {
    managerRegisterMode?: 'CREATE_TENANT' | 'JOIN_TENANT' | string;
    tenantRole?: 'TENANT_OWNER' | 'MANAGER' | string;
    tenantCode?: string;
  } | null;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  createdAt?: string;
};

function toArray(value: any): ApprovalItem[] {
  const raw = Array.isArray(value)
    ? value
    : Array.isArray(value?.items)
      ? value.items
      : Array.isArray(value?.data?.items)
        ? value.data.items
        : Array.isArray(value?.data)
          ? value.data
          : [];

  return raw.map((item: any) => ({
    id: item.id,
    requesterId: item.requesterId,
    name: item.name ?? item.requester?.name ?? '-',
    email: item.email ?? item.requester?.email ?? '-',
    phone:
      item.phone ??
      item.requester?.phone ??
      item.requester?.profile?.phone ??
      item.managerProfile?.phone ??
      '-',
    companyName:
      item.companyName ??
      item.company ??
      item.requester?.companyName ??
      item.requester?.company ??
      '-',
    requestData: item.requestData ?? item.data?.requestData ?? null,
    status: item.status ?? 'PENDING',
    createdAt: item.createdAt,
  }));
}

function formatDate(value?: string) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function managerRegisterModeLabel(value?: string) {
  if (value === 'JOIN_TENANT') return '기존 기업 가입';
  if (value === 'CREATE_TENANT') return '새 기업 등록';
  return '-';
}

function tenantRoleLabel(value?: string) {
  if (value === 'TENANT_OWNER') return 'Tenant 대표';
  if (value === 'MANAGER') return '운영 Manager';
  return '-';
}

function statusLabel(value?: string) {
  if (value === 'PENDING') return '대기';
  if (value === 'APPROVED') return '승인';
  if (value === 'REJECTED') return '반려';
  return value ?? '-';
}

export default function ManagerApprovalsPage() {
  const searchParams = useSearchParams();
  const { session, logout } = useAuth();

  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(
    () => parseTableQueryFromSearchParams(searchParams),
    [searchParams],
  );

  const filteredItems = useMemo(() => {
    const keyword = query.q.trim().toLowerCase();

    return items.filter((item) => {
      if (query.status && item.status !== query.status) return false;
      if (!keyword) return true;

      return [
        item.name,
        item.email,
        item.phone,
        item.companyName,
        item.requestData?.managerRegisterMode,
        item.requestData?.tenantRole,
        item.requestData?.tenantCode,
        item.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [items, query.q, query.status]);

  const meta = useMemo(
    () =>
      createPaginationMeta({
        page: query.page,
        pageSize: query.pageSize,
        total: filteredItems.length,
      }),
    [filteredItems.length, query.page, query.pageSize],
  );

  const pagedItems = useMemo(
    () => paginateClientSide(filteredItems, meta.page, meta.pageSize),
    [filteredItems, meta.page, meta.pageSize],
  );

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const result = await fetchManagerApprovals(
        {
          page: 1,
          pageSize: 500,
          sort: 'createdAt',
        },
        session.accessToken,
      );

      setItems(toArray(result));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load approvals.';

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

  async function review(
    item: ApprovalItem,
    status: 'APPROVED' | 'REJECTED',
  ) {
    if (!session?.accessToken) return;

    const reviewedNote =
      status === 'APPROVED'
        ? 'Manager account approved by admin.'
        : 'Manager account rejected by admin.';

    try {
      setReviewingId(item.id);
      setError(null);

      await reviewApprovalRequest(
        session.accessToken,
        item.id,
        status,
        reviewedNote,
      );

      await load();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to review request.',
      );
    } finally {
      setReviewingId(null);
    }
  }

  return (
    <main className="space-y-6 p-6 w-full max-w-none">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          매니저 계정 승인
        </h1>
        <p className="text-sm text-slate-500">
          1단계: 관리자가 매니저 계정을 승인합니다. 주차장 접근 권한은 이후 별도로 승인합니다.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div className="font-semibold text-slate-900">
            매니저 계정 신청 목록
          </div>

          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
          >
            {loading ? '불러오는 중...' : '새로고침'}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-5 py-3">번호</th>
                <th className="px-5 py-3">이름</th>
                <th className="px-5 py-3">이메일</th>
                <th className="px-5 py-3">전화번호</th>
                <th className="px-5 py-3">회사명</th>
                <th className="px-5 py-3">가입 유형</th>
                <th className="px-5 py-3">승인 역할</th>
                <th className="px-5 py-3">Tenant 코드</th>
                <th className="px-5 py-3">신청일</th>
                <th className="px-5 py-3">상태</th>
                <th className="px-5 py-3">처리</th>
              </tr>
            </thead>

            <tbody>
              {pagedItems.map((item, index) => (
                <tr key={item.id} className="border-t">
                  <td className="px-5 py-3 font-medium text-slate-700">
                    {getRowNumber({
                      page: meta.page,
                      pageSize: meta.pageSize,
                      index,
                    })}
                  </td>

                  <td className="px-5 py-3">{item.name ?? '-'}</td>
                  <td className="px-5 py-3">{item.email ?? '-'}</td>
                  <td className="px-5 py-3">{item.phone ?? '-'}</td>
                  <td className="px-5 py-3">{item.companyName ?? '-'}</td>

                  <td className="px-5 py-3">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {managerRegisterModeLabel(item.requestData?.managerRegisterMode)}
                    </span>
                  </td>

                  <td className="px-5 py-3">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                      {tenantRoleLabel(item.requestData?.tenantRole)}
                    </span>
                  </td>

                  <td className="px-5 py-3 font-mono text-xs text-slate-600">
                    {item.requestData?.tenantCode ?? '-'}
                  </td>

                  <td className="px-5 py-3">{formatDate(item.createdAt)}</td>

                  <td className="px-5 py-3">
                    <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-700">
                      {statusLabel(item.status)}
                    </span>
                  </td>

                  <td className="px-5 py-3">
                    {item.status === 'APPROVED' || item.status === 'REJECTED' ? (
                      <span className="text-xs text-slate-500">
                        {statusLabel(item.status)}
                      </span>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={reviewingId === item.id}
                          onClick={() => void review(item, 'APPROVED')}
                          className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          승인
                        </button>

                        <button
                          type="button"
                          disabled={reviewingId === item.id}
                          onClick={() => void review(item, 'REJECTED')}
                          className="rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          반려
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}

              {!loading && filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-5 py-10 text-center text-slate-500"
                  >
                    매니저 계정 승인 요청이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <PaginationBar meta={meta} />
    </main>
  );
}
