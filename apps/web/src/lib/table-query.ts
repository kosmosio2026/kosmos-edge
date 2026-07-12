import type { PaginationMeta } from '@/types/pagination';

export type TableQuery = {
  q: string;
  page: number;
  pageSize: number;
  sort: string;
  status?: string;
  region?: string;
  parkingLotId?: string;
  sectionId?: string;
};

export function normalizeTableQuery(
  input: Partial<TableQuery>,
): TableQuery {
  return {
    q: input.q ?? '',
    page:
      typeof input.page === 'number' && input.page > 0
        ? Math.floor(input.page)
        : 1,

    pageSize:
      typeof input.pageSize === 'number' && input.pageSize > 0
        ? Math.floor(input.pageSize)
        : 10,

    sort: input.sort?.trim() || 'createdAt',

    status: input.status || undefined,
    region: input.region || undefined,
    parkingLotId: input.parkingLotId || undefined,
    sectionId: input.sectionId || undefined,
  };
}

export function parseTableQueryFromSearchParams(
  searchParams: URLSearchParams,
): TableQuery {
  return normalizeTableQuery({
    q: searchParams.get('q') ?? '',
    page: Number(searchParams.get('page') ?? '1'),
    pageSize: Number(searchParams.get('pageSize') ?? '10'),
    sort: searchParams.get('sort') ?? 'createdAt',
    status: searchParams.get('status') ?? undefined,
    region: searchParams.get('region') ?? undefined,
    parkingLotId: searchParams.get('parkingLotId') ?? undefined,
    sectionId: searchParams.get('sectionId') ?? undefined,
  });
}

export function createPaginationMeta(input: {
  page: number;
  pageSize: number;
  total: number;
}): PaginationMeta {
  const pageSize =
    Number.isFinite(input.pageSize) && input.pageSize > 0
      ? Math.floor(input.pageSize)
      : 10;

  const total =
    Number.isFinite(input.total) && input.total > 0
      ? Math.floor(input.total)
      : 0;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const page =
    Number.isFinite(input.page) && input.page > 0
      ? Math.min(Math.floor(input.page), totalPages)
      : 1;

  return {
    page,
    pageSize,
    total,
    totalPages,
  };
}

export function paginateClientSide<T>(
  items: T[],
  page: number,
  pageSize: number,
): T[] {
  const meta = createPaginationMeta({
    page,
    pageSize,
    total: items.length,
  });

  const start = (meta.page - 1) * meta.pageSize;
  const end = start + meta.pageSize;

  return items.slice(start, end);
}

export function getRowNumber(input: {
  page: number;
  pageSize: number;
  index: number;
}) {
  return (input.page - 1) * input.pageSize + input.index + 1;
}

export function unwrapItems<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (!value || typeof value !== 'object') return [];

  const obj = value as {
    items?: unknown;
    data?: unknown;
  };

  if (Array.isArray(obj.items)) return obj.items as T[];

  if (Array.isArray(obj.data)) return obj.data as T[];

  if (
    obj.data &&
    typeof obj.data === 'object' &&
    Array.isArray((obj.data as { items?: unknown }).items)
  ) {
    return (obj.data as { items: T[] }).items;
  }

  return [];
}

export function unwrapPaginationMeta(
  value: unknown,
  fallback: {
    page: number;
    pageSize: number;
    total: number;
  },
): PaginationMeta {
  if (value && typeof value === 'object') {
    const obj = value as {
      meta?: Partial<PaginationMeta>;
      data?: {
        meta?: Partial<PaginationMeta>;
      };
    };

    const meta = obj.meta ?? obj.data?.meta;

    if (meta) {
      return createPaginationMeta({
        page: Number(meta.page ?? fallback.page),
        pageSize: Number(meta.pageSize ?? fallback.pageSize),
        total: Number(meta.total ?? fallback.total),
      });
    }
  }

  return createPaginationMeta(fallback);
}