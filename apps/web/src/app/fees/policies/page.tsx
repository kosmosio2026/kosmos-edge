import { AppShell } from '@/components/layout/app-shell';
import { FeePoliciesPage } from '@/components/admin/fee-policies-page';
import { getFeePolicyItems } from '@/lib/admin-server-data';
import { getSession } from '@/lib/session';
import { applyPagination, applySearch, applySort, normalizeTableQuery } from '@/lib/admin-query';

export default async function FeePoliciesRoutePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSession();
  const params = await searchParams;
  const query = normalizeTableQuery({
    q: typeof params.q === 'string' ? params.q : '',
    page: Number(typeof params.page === 'string' ? params.page : '1'),
    pageSize: Number(typeof params.pageSize === 'string' ? params.pageSize : '10'),
    sort: typeof params.sort === 'string' ? params.sort : 'name',
    order: params.order === 'asc' ? 'asc' : 'desc',
  });

  const allItems = await getFeePolicyItems();
  const searched = applySearch(allItems, query.q, (item) => [item.name, item.code, item.lotName ?? '']);
  const sorted = applySort(searched, query.sort, query.order, (item, sort) => {
    if (sort === 'code') return item.code;
    if (sort === 'status') return item.isActive ? 'ACTIVE' : 'INACTIVE';
    return item.name;
  });
  const { items, pagination } = applyPagination(sorted, query.page, query.pageSize);

  return (
    <AppShell>
      <FeePoliciesPage initialItems={items} pagination={pagination} />
    </AppShell>
  );
}