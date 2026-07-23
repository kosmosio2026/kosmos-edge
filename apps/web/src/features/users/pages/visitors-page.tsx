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

type VisitorItem = {
  id: string;
  name?: string | null;
  phone?: string | null;
  plateNumber?: string | null;
  createdAt?: string | null;
  visitorProfile?: {
    phone?: string | null;
    vehicleNo?: string | null;
  } | null;
};

function formatDate(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

export default function VisitorsPage({ role = 'admin' }: Props) {
  const searchParams = useSearchParams();
  const { session } = useAuth();

  const [items, setItems] = useState<VisitorItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<VisitorItem | null>(null);

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
        item.phone,
        item.plateNumber,
        item.visitorProfile?.phone,
        item.visitorProfile?.vehicleNo,
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
      const res = await apiFetch('/users/visitors', {
        accessToken: session.accessToken,
      });

      setItems(unwrapItems<VisitorItem>(res));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load visitors.');
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
        <h1 className="text-2xl font-bold">방문객</h1>
        <p className="text-sm text-slate-500">
          '방문자 조회'
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
              <th className="px-5 py-3">전화번호</th>
              <th className="px-5 py-3">차량 번호</th>
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
                <td className="px-5 py-3">
                  <button
                    type="button"
                    onClick={() => setSelected(item)}
                    className="font-bold text-blue-700 hover:underline"
                  >
                    {item.name ?? '-'}
                  </button>
                </td>
                <td className="px-5 py-3">
                  {item.visitorProfile?.phone ?? item.phone ?? '-'}
                </td>
                <td className="px-5 py-3">
                  {item.visitorProfile?.vehicleNo ?? item.plateNumber ?? '-'}
                </td>
              </tr>
            ))}

            {!loading && filteredItems.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-10 text-center text-slate-500"
                >
                  방문객이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <PaginationBar meta={meta} />

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <section className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-600">
                  Visitor Detail
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">방문객 상세 정보</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700"
              >
                닫기
              </button>
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border">
              <table className="w-full text-sm">
                <tbody>
                  {[
                    ['이름', selected.name ?? '-'],
                    ['전화번호', selected.visitorProfile?.phone ?? selected.phone ?? '-'],
                    ['차량 번호', selected.visitorProfile?.vehicleNo ?? selected.plateNumber ?? '-'],
                    ['생성일시', formatDate(selected.createdAt)],
                  ].map(([label, value]) => (
                    <tr key={label} className="border-b last:border-b-0">
                      <th className="w-40 bg-slate-50 px-4 py-3 text-left font-black text-slate-600">
                        {label}
                      </th>
                      <td className="px-4 py-3 text-slate-900">{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}