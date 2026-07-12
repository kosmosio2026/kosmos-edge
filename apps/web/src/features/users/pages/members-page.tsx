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

type Role = 'admin' | 'manager' | 'operator';

type Props = {
  role?: Role;
};

type MemberItem = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  plateNumber?: string | null;
  isApproved?: boolean | null;
  memberProfile?: {
    phone?: string | null;
    vehicleNo?: string | null;
  } | null;
};

export default function MembersPage({ role = 'admin' }: Props) {
  const searchParams = useSearchParams();
  const { session } = useAuth();

  const [items, setItems] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(
    () => parseTableQueryFromSearchParams(searchParams),
    [searchParams],
  );

  const filteredItems = useMemo(() => {
    const keyword = query.q.trim().toLowerCase();

    if (!keyword) return items;

    return items.filter((item) =>
      [
        item.name,
        item.email,
        item.phone,
        item.plateNumber,
        item.memberProfile?.phone,
        item.memberProfile?.vehicleNo,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    );
  }, [items, query.q]);

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
      const res = await apiFetch('/users/members', {
        accessToken: session.accessToken,
      });

      setItems(unwrapItems<MemberItem>(res));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load members.');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">회원</h1>
        <p className="text-sm text-slate-500">
          '회원 조회'
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? <div className="text-sm text-slate-500">불러오는 중...</div> : null}

      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-5 py-3">번호</th>
              <th className="px-5 py-3">이름</th>
              <th className="px-5 py-3">이메일</th>
              <th className="px-5 py-3">전화번호</th>
              <th className="px-5 py-3">Vehicle</th>
              <th className="px-5 py-3">Approved</th>
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
                <td className="px-5 py-3">
                  {item.memberProfile?.phone ?? item.phone ?? '-'}
                </td>
                <td className="px-5 py-3">
                  {item.memberProfile?.vehicleNo ?? item.plateNumber ?? '-'}
                </td>
                <td className="px-5 py-3">
                  {item.isApproved ? 'Approved' : 'Pending'}
                </td>
              </tr>
            ))}

            {!loading && filteredItems.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-5 py-10 text-center text-slate-500"
                >
                  회원이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <PaginationBar meta={meta} />
    </main>
  );
}