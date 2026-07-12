export type TableQuery = {
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: 'asc' | 'desc';
};

export function normalizeTableQuery(input: Partial<TableQuery>): Required<TableQuery> {
  return {
    q: input.q?.trim() ?? '',
    page: Number.isFinite(input.page) && (input.page ?? 1) > 0 ? Number(input.page) : 1,
    pageSize:
      Number.isFinite(input.pageSize) && (input.pageSize ?? 10) > 0
        ? Number(input.pageSize)
        : 10,
    sort: input.sort?.trim() || 'createdAt',
    order: input.order === 'asc' ? 'asc' : 'desc',
  };
}

export function applySearch<T>(
  items: T[],
  q: string,
  getter: (item: T) => string[],
) {
  if (!q) return items;
  const keyword = q.toLowerCase();
  return items.filter((item) =>
    getter(item).some((value) => value.toLowerCase().includes(keyword)),
  );
}

export function applySort<T>(
  items: T[],
  sort: string,
  order: 'asc' | 'desc',
  getter: (item: T, sort: string) => string | number,
) {
  const sorted = [...items].sort((a, b) => {
    const av = getter(a, sort);
    const bv = getter(b, sort);

    if (typeof av === 'number' && typeof bv === 'number') {
      return av - bv;
    }
    return String(av).localeCompare(String(bv));
  });

  return order === 'asc' ? sorted : sorted.reverse();
}

export function applyPagination<T>(
  items: T[],
  page: number,
  pageSize: number,
) {
  const total = items.length;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: items.slice(start, end),
    pagination: {
      page: safePage,
      pageSize,
      total,
      totalPages,
    },
  };
}