'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function TableToolbar({
  searchPlaceholder = '검색',
}: {
  searchPlaceholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    if (key !== 'page') params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="grid gap-3 rounded-3xl border bg-white p-4 md:grid-cols-4">
      <input
        className="rounded-2xl border px-4 py-3 text-sm"
        placeholder={searchPlaceholder}
        defaultValue={searchParams.get('q') ?? ''}
        onChange={(e) => update('q', e.target.value)}
      />

      <select
        className="rounded-2xl border px-4 py-3 text-sm"
        defaultValue={searchParams.get('sort') ?? 'createdAt'}
        onChange={(e) => update('sort', e.target.value)}
      >
        <option value="createdAt">정렬: Created</option>
        <option value="name">정렬: Name</option>
        <option value="code">정렬: Code</option>
        <option value="status">정렬: Status</option>
      </select>

      <select
        className="rounded-2xl border px-4 py-3 text-sm"
        defaultValue={searchParams.get('order') ?? 'desc'}
        onChange={(e) => update('order', e.target.value)}
      >
        <option value="desc">내림차순</option>
        <option value="asc">오름차순</option>
      </select>

      <select
        className="rounded-2xl border px-4 py-3 text-sm"
        defaultValue={searchParams.get('pageSize') ?? '10'}
        onChange={(e) => update('pageSize', e.target.value)}
      >
        <option value="10">10개</option>
        <option value="20">20개</option>
        <option value="50">50개</option>
      </select>
    </div>
  );
}