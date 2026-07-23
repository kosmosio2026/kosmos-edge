function createPaginatedResponse(args) {
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
      hasPreviousPage: args.page > 1
    }
  };
}

module.exports = { createPaginatedResponse };
