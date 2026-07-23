'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PaginationBar } from '@/components/console/pagination-bar';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';
import {
  createPaginationMeta,
  getRowNumber,
  paginateClientSide,
  parseTableQueryFromSearchParams,
  unwrapItems,
} from '@/lib/table-query';

type StaffRole = 'managers' | 'operators';

type Props = {
  roleType: StaffRole;
  title: string;
};

type ApprovalScopeItem = {
  id?: string;
  region?: string | null;
  parkingLotName?: string | null;
  lotName?: string | null;
  parkingSectionName?: string | null;
  sectionName?: string | null;
  name?: string | null;
  code?: string | null;
  approved?: boolean | null;
  isApproved?: boolean | null;
  status?: string | null;
  spaces?: number | null;
  spaceCount?: number | null;
};

type StaffUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  companyName?: string | null;
  company?: string | null;
  phone?: string | null;
  status?: string | null;
  isApproved?: boolean | null;
  roles?: string[];
  role?: string | null;
  approvedAt?: string | null;
  createdAt?: string | null;
  parkingLots?: ApprovalScopeItem[];
  parkingLotRequests?: ApprovalScopeItem[];
  sections?: ApprovalScopeItem[];
  sectionRequests?: ApprovalScopeItem[];
  approvalSummary?: {
    requested?: number;
    approved?: number;
  };
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: '관리자',
  MANAGER: '매니저',
  OPERATOR: '운영자',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '활성',
  PENDING: '승인대기',
  APPROVED: '승인',
  SUSPENDED: '정지',
  REJECTED: '거절',
};

function getRoleLabel(role?: string | null) {
  if (!role) return '-';
  return ROLE_LABELS[role] ?? role;
}

function getRoleText(row: StaffUser) {
  if (row.roles?.length) {
    return row.roles.map(getRoleLabel).join(', ');
  }

  return getRoleLabel(row.role);
}

function getStatusLabel(status?: string | null) {
  if (!status) return '-';
  return STATUS_LABELS[status] ?? status;
}

function formatCompactDateTime(value?: string | Date | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const pad = (num: number) => String(num).padStart(2, '0');

  const yy = pad(date.getFullYear() % 100);
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const ss = pad(date.getSeconds());

  return `${yy}.${mm}.${dd} ${hh}:${mi}:${ss}`;
}

function isApprovedScope(item: ApprovalScopeItem) {
  if (item.approved === true || item.isApproved === true) return true;
  return item.status === 'APPROVED';
}

function getScopes(row: StaffUser, roleType: StaffRole): ApprovalScopeItem[] {
  if (roleType === 'managers') {
    return row.parkingLotRequests ?? row.parkingLots ?? [];
  }

  return row.sectionRequests ?? row.sections ?? [];
}

function getApprovalSummary(row: StaffUser, roleType: StaffRole) {
  if (row.approvalSummary) {
    return {
      requested: row.approvalSummary.requested ?? 0,
      approved: row.approvalSummary.approved ?? 0,
    };
  }

  const scopes = getScopes(row, roleType);

  return {
    requested: scopes.length,
    approved: scopes.filter(isApprovedScope).length,
  };
}

function getScopeLabel(row: StaffUser, roleType: StaffRole) {
  const summary = getApprovalSummary(row, roleType);

  if (summary.requested <= 0) {
    return roleType === 'managers' ? '주차장 없음' : '구역 없음';
  }

  return `${summary.approved}/${summary.requested} 승인`;
}

export default function StaffUsersPage({ roleType, title }: Props) {
  const searchParams = useSearchParams();
  const { session } = useAuth();

  const [rows, setRows] = useState<StaffUser[]>([]);
  const [selected, setSelected] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(
    () => parseTableQueryFromSearchParams(searchParams),
    [searchParams],
  );

  const filteredRows = useMemo(() => {
    const keyword = query.q.trim().toLowerCase();

    return rows.filter((row) => {
      if (query.status && row.status !== query.status) return false;
      if (!keyword) return true;

      return [
        row.name,
        row.email,
        row.companyName,
        row.company,
        row.phone,
        row.status,
        row.roles?.join(', '),
        row.role,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [query.q, query.status, rows]);

  const meta = useMemo(
    () =>
      createPaginationMeta({
        page: query.page,
        pageSize: query.pageSize,
        total: filteredRows.length,
      }),
    [filteredRows.length, query.page, query.pageSize],
  );

  const pagedRows = useMemo(
    () => paginateClientSide(filteredRows, meta.page, meta.pageSize),
    [filteredRows, meta.page, meta.pageSize],
  );

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch(`/users/${roleType}`, {
        accessToken: session.accessToken,
      });

      setRows(unwrapItems<StaffUser>(res));
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, roleType]);

  useEffect(() => {
    void load();
  }, [load]);

  async function reviewScope(
    scope: ApprovalScopeItem,
    status: 'APPROVED' | 'REJECTED',
  ) {
    if (!session?.accessToken || !scope.id) return;

    const endpoint =
      roleType === 'managers'
        ? `/approvals/manager-lots/${scope.id}/review`
        : `/approvals/operator-sections/${scope.id}/review`;

    setActionLoadingId(scope.id);
    setError(null);

    try {
      await apiFetch(endpoint, {
        method: 'POST',
        accessToken: session.accessToken,
        body: JSON.stringify({
          status,
        }),
      });

      await load();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to update approval status.',
      );
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <main className="w-full max-w-none space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">
            계정 목록 및 승인 상태 관리
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          {loading ? '불러오는 중...' : '새로고침'}
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
              <Th>이름</Th>
              {roleType === 'managers' ? <Th>회사</Th> : null}
              {roleType === 'operators' ? <Th>구역</Th> : null}
              <Th>전화번호</Th>
              <Th>역할</Th>
              <Th>상태</Th>
              <Th>승인</Th>
              <Th>승인일시</Th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-10 text-center text-slate-500"
                >
                  불러오는 중...
                </td>
              </tr>
            ) : pagedRows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-10 text-center text-slate-500"
                >
                  사용자가 없습니다.
                </td>
              </tr>
            ) : (
              pagedRows.map((row, index) => {
                const scopeLabel = getScopeLabel(row, roleType);

                return (
                  <tr key={row.id} className="border-t">
                    <Td>
                      {getRowNumber({
                        page: meta.page,
                        pageSize: meta.pageSize,
                        index,
                      })}
                    </Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => setSelected(row)}
                        className="font-medium text-slate-900 underline-offset-2 hover:underline"
                      >
                        {row.name ?? '-'}
                      </button>
                    </Td>

                    {roleType === 'managers' ? (
                      <Td>{row.companyName ?? row.company ?? '-'}</Td>
                    ) : null}

                    {roleType === 'operators' ? (
                      <Td>
                        <button
                          type="button"
                          onClick={() => setSelected(row)}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {scopeLabel}
                        </button>
                      </Td>
                    ) : null}

                    <Td>{row.phone ?? '-'}</Td>
                    <Td>{getRoleText(row)}</Td>
                    <Td>{getStatusLabel(row.status)}</Td>
                    <Td>
                      {roleType === 'managers' ? (
                        <button
                          type="button"
                          onClick={() => setSelected(row)}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {scopeLabel}
                        </button>
                      ) : row.isApproved ? (
                        '예'
                      ) : (
                        '아니오'
                      )}
                    </Td>
                    <Td>{formatCompactDateTime(row.approvedAt)}</Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <PaginationBar meta={meta} />

      {selected ? (
        <ScopeModal
          row={selected}
          roleType={roleType}
          scopes={getScopes(selected, roleType)}
          actionLoadingId={actionLoadingId}
          onClose={() => setSelected(null)}
          onReview={(scope, status) => void reviewScope(scope, status)}
        />
      ) : null}
    </main>
  );
}

function ScopeModal({
  row,
  roleType,
  scopes,
  actionLoadingId,
  onClose,
  onReview,
}: {
  row: StaffUser;
  roleType: StaffRole;
  scopes: ApprovalScopeItem[];
  actionLoadingId: string | null;
  onClose: () => void;
  onReview: (scope: ApprovalScopeItem, status: 'APPROVED' | 'REJECTED') => void;
}) {
  const title =
    roleType === 'managers'
      ? `${row.name ?? '-'} 상세정보`
      : `${row.name ?? '-'} 상세정보`;
  const scopeTitle = roleType === 'managers' ? '주차장 승인 정보' : '구역 승인 정보';
  const emptyScopeText = roleType === 'managers' ? '주차장 없음' : '구역 없음';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-4xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-500">
              기본 정보와 승인 범위를 확인합니다.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
          >
            닫기
          </button>
        </div>

        <div className="mt-5 rounded-2xl border bg-slate-50 p-4">
          <dl className="grid grid-cols-[96px_1fr] gap-x-4 gap-y-3 text-sm md:grid-cols-[96px_1fr_96px_1fr]">
            <dt className="text-slate-500">이름</dt>
            <dd className="font-medium text-slate-900">{row.name ?? '-'}</dd>

            <dt className="text-slate-500">이메일</dt>
            <dd className="text-slate-900">{row.email ?? '-'}</dd>

            <dt className="text-slate-500">전화번호</dt>
            <dd className="text-slate-900">{row.phone ?? '-'}</dd>

            <dt className="text-slate-500">회사</dt>
            <dd className="text-slate-900">
              {row.companyName ?? row.company ?? '-'}
            </dd>

            <dt className="text-slate-500">역할</dt>
            <dd className="text-slate-900">{getRoleText(row)}</dd>

            <dt className="text-slate-500">상태</dt>
            <dd className="text-slate-900">{getStatusLabel(row.status)}</dd>

            <dt className="text-slate-500">승인일시</dt>
            <dd className="text-slate-900 md:col-span-3">
              {formatCompactDateTime(row.approvedAt)}
            </dd>
          </dl>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border">
          <div className="border-b bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-700">
            {scopeTitle}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <Th>번호</Th>
                <Th>지역</Th>
                <Th>주차장</Th>
                <Th>이름</Th>
                <Th>코드</Th>
                <Th>승인</Th>
                {roleType === 'operators' ? <Th>주차면</Th> : null}
                <Th>관리</Th>
              </tr>
            </thead>

            <tbody>
              {scopes.map((scope, index) => {
                const approved = isApprovedScope(scope);

                return (
                  <tr key={scope.id ?? index} className="border-t">
                    <Td>{index + 1}</Td>
                    <Td>{scope.region ?? '-'}</Td>
                    <Td>{scope.parkingLotName ?? scope.lotName ?? '-'}</Td>
                    <Td>
                      {roleType === 'managers'
                        ? scope.name ??
                          scope.parkingLotName ??
                          scope.lotName ??
                          '-'
                        : scope.name ??
                          scope.parkingSectionName ??
                          scope.sectionName ??
                          '-'}
                    </Td>
                    <Td>{scope.code ?? '-'}</Td>
                    <Td>{approved ? '승인' : '승인대기'}</Td>
                    {roleType === 'operators' ? (
                      <Td>{scope.spaces ?? scope.spaceCount ?? '-'}</Td>
                    ) : null}
                    <Td>
                      {approved ? (
                        <span className="text-xs text-slate-500">승인</span>
                      ) : scope.id ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={actionLoadingId === scope.id}
                            onClick={() => onReview(scope, 'APPROVED')}
                            className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            승인
                          </button>
                          <button
                            type="button"
                            disabled={actionLoadingId === scope.id}
                            onClick={() => onReview(scope, 'REJECTED')}
                            className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 disabled:opacity-50"
                          >
                            거절
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">
                          요청 ID 없음
                        </span>
                      )}
                    </Td>
                  </tr>
                );
              })}

              {scopes.length === 0 ? (
                <tr>
                  <td
                    colSpan={roleType === 'operators' ? 8 : 7}
                    className="px-5 py-10 text-center text-slate-500"
                  >
                    {emptyScopeText}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-5 py-3 font-medium">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-5 py-3">{children}</td>;
}
