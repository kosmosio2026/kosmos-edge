'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { PaginationMeta } from '@/types/pagination';

type Props = {
  meta: PaginationMeta;
  pageSizeOptions?: number[];
};

export function PaginationBar({
  meta,
  pageSizeOptions = [10, 20, 50, 100],
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(paramsToSet: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(paramsToSet).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    router.push(`${pathname}?${params.toString()}`);
  }

  function move(page: number) {
    const nextPage = Math.min(Math.max(page, 1), meta.totalPages);
    update({ page: String(nextPage) });
  }

  function changePageSize(pageSize: string) {
    update({
      page: '1',
      pageSize,
    });
  }

  const from =
    meta.total === 0 ? 0 : (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.total);

  return (
    <div className="flex flex-col gap-3 rounded-3xl border bg-white px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
      <div className="text-slate-500">
        {from}-{to} of {meta.total} · page {meta.page} / {meta.totalPages}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={meta.pageSize}
          onChange={(event) => changePageSize(event.target.value)}
          className="rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
        >
          {pageSizeOptions.map((value) => (
            <option key={value} value={value}>
              {value} / page
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={meta.page <= 1}
          onClick={() => move(1)}
          className="rounded-xl border px-3 py-2 disabled:opacity-40"
        >
          First
        </button>

        <button
          type="button"
          disabled={meta.page <= 1}
          onClick={() => move(meta.page - 1)}
          className="rounded-xl border px-3 py-2 disabled:opacity-40"
        >
          Prev
        </button>

        <button
          type="button"
          disabled={meta.page >= meta.totalPages}
          onClick={() => move(meta.page + 1)}
          className="rounded-xl border px-3 py-2 disabled:opacity-40"
        >
          Next
        </button>

        <button
          type="button"
          disabled={meta.page >= meta.totalPages}
          onClick={() => move(meta.totalPages)}
          className="rounded-xl border px-3 py-2 disabled:opacity-40"
        >
          Last
        </button>
      </div>
    </div>
  );
}