'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PaginationBar } from '@/components/console/pagination-bar';
import { useAuth } from '@/components/providers/auth-provider';
import {
  fetchOperatorApprovals,
  reviewApprovalRequest,
} from '@/lib/fetchers';
import {
  createPaginationMeta,
  getRowNumber,
  paginateClientSide,
  parseTableQueryFromSearchParams,
} from '@/lib/table-query';

type Role = 'admin' | 'manager';

type ApprovalItem = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  createdAt?: string;
  status?: string;
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
    name: item.name ?? item.requester?.name ?? item.operator?.name ?? '-',
    email: item.email ?? item.requester?.email ?? item.operator?.email ?? '-',
    phone:
      item.phone ??
      item.requester?.phone ??
      item.operator?.phone ??
      item.operatorProfile?.phone ??
      '-',
    companyName:
      item.companyName ??
      item.company ??
      item.requester?.companyName ??
      item.operator?.companyName ??
      item.operatorProfile?.companyName ??
      '-',
    createdAt: item.createdAt,
    status: item.status ?? 'PENDING',
  }));
}

function formatDate(value?: string) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function statusLabel(value?: string) {
  if (value === 'PENDING') return '대기';
  if (value === 'APPROVED') return '승인';
  if (value === 'REJECTED') return '반려';
  return value ?? '-';
}

export default function OperatorApprovalsPage({
  role = 'admin',
}: {
  role?: Role;
}) {
  const searchParams = useSearchParams();
  const { session, logout } = useAuth();

  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [selected, setSelected] = useState<ApprovalItem | null>(null);
  const [parkingLotIds, setParkingLotIds] = useState('');
  const [parkingSectionIds, setParkingSectionIds] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginPath = role === 'manager' ? '/manager/login' : '/admin/login';

  const query = useMemo(
    () => parseTableQueryFromSearchParams(searchParams),
    [searchParams],
  );

  const filteredItems = useMemo(() => {
    const keyword = query.q.trim().toLowerCase();

    return items.filter((item) => {
      if (query.status && item.status !== query.status) return false;
      if (!keyword) return true;

      return [item.name, item.email, item.phone, item.companyName, item.status]
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
      const result = await fetchOperatorApprovals(
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
        error instanceof Error
          ? error.message
          : '운영자 승인 요청을 불러오지 못했습니다.';

      if (message.toLowerCase().includes('unauthorized')) {
        logout(loginPath);
        return;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, logout, loginPath]);

  useEffect(() => {
    void load();
  }, [load]);

  async function review(status: 'APPROVED' | 'REJECTED') {
    if (!session?.accessToken || !selected) return;

    try {
      setReviewing(true);
      setError(null);

      await reviewApprovalRequest(
        session.accessToken,
        selected.id,
        status,
        note,
        {
          parkingLotIds: parkingLotIds
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
          parkingSectionIds: parkingSectionIds
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
        },
      );

      setSelected(null);
      setParkingLotIds('');
      setParkingSectionIds('');
      setNote('');
      await load();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : '운영자 승인 요청 처리에 실패했습니다.',
      );
    } finally {
      setReviewing(false);
    }
  }

  return (
    <main className="space-y-6 p-6 w-full max-w-none">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          운영자 계정 승인
        </h1>
        <p className="text-sm text-slate-500">
          1단계: 운영자 계정을 승인합니다. 주차장 구역 접근 권한은 이후 별도로 승인합니다.
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
            운영자 계정 신청 목록
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
              <th className="px-5 py-3">이름</th>
              <th className="px-5 py-3">이메일</th>
              <th className="px-5 py-3">전화번호</th>
              <th className="px-5 py-3">회사명</th>
              <th className="px-5 py-3">상태</th>
              <th className="px-5 py-3">생성일</th>
              <th className="px-5 py-3">처리</th>
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
                <td className="px-5 py-3">{item.name ?? '-'}</td>
                <td className="px-5 py-3">{item.email ?? '-'}</td>
                <td className="px-5 py-3">{item.phone ?? '-'}</td>
                <td className="px-5 py-3">{item.companyName ?? '-'}</td>
                <td className="px-5 py-3">{statusLabel(item.status)}</td>
                <td className="px-5 py-3">{formatDate(item.createdAt)}</td>
                <td className="px-5 py-3">
                  <button
                    type="button"
                    onClick={() => setSelected(item)}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
                  >
                    검토
                  </button>
                </td>
              </tr>
            ))}

            {!loading && filteredItems.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-10 text-center text-slate-500"
                >
                  대기 중인 운영자 계정 승인 요청이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <PaginationBar meta={meta} />

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-none rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-900">
              운영자 승인 검토
            </h2>

            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm">
              <div>{selected.name}</div>
              <div className="text-slate-500">{selected.email}</div>
              <div className="text-slate-500">{selected.phone}</div>
              <div className="text-slate-500">{selected.companyName}</div>
            </div>

            <label className="mt-5 block">
              <span className="text-sm font-medium text-slate-700">
                주차장 ID
              </span>
              <input
                value={parkingLotIds}
                onChange={(event) => setParkingLotIds(event.target.value)}
                placeholder="lotId1, lotId2"
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-sm font-medium text-slate-700">
                주차 구역 ID
              </span>
              <input
                value={parkingSectionIds}
                onChange={(event) => setParkingSectionIds(event.target.value)}
                placeholder="sectionId1, sectionId2"
                className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-sm font-medium text-slate-700">
                검토 메모
              </span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="mt-2 min-h-24 w-full rounded-2xl border px-4 py-3 text-sm"
              />
            </label>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-xl border px-4 py-2 text-sm"
              >
                취소
              </button>
              <button
                type="button"
                disabled={reviewing}
                onClick={() => void review('REJECTED')}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                반려
              </button>
              <button
                type="button"
                disabled={reviewing}
                onClick={() => void review('APPROVED')}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                승인
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
