export type PaginationMeta = {
  total: number;
  page: number;
  pageSize: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  [key: string]: unknown;
};

export type PaginatedResponse<T> = {
  items?: T[];
  data?: T[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPreviousPage?: boolean;
  meta?: PaginationMeta;
};

export function createPaginatedResponse<T>(args: {
  items?: T[];
  data?: T[];
  total: number;
  page: number;
  pageSize: number;
}): PaginatedResponse<T> {
  const items = args.items ?? args.data ?? [];
  const totalPages = Math.max(1, Math.ceil(args.total / args.pageSize));

  return {
    items,
    data: items,
    total: args.total,
    page: args.page,
    pageSize: args.pageSize,
    totalPages,
    hasNextPage: args.page < totalPages,
    hasPreviousPage: args.page > 1,
    meta: {
      total: args.total,
      page: args.page,
      pageSize: args.pageSize,
      totalPages,
      hasNextPage: args.page < totalPages,
      hasPreviousPage: args.page > 1,
    },
  };
}
