import { ListPageShell } from '@/components/console/list-page-shell';
import { PageHeader } from '@/components/console/page-header';
import { ConsoleFilterBar } from '@/components/console/filter-bar';
import { DataTable } from '@/components/console/data-table';
import type { UserListItem } from '@/types/admin';

export function UsersListPage({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: UserListItem[];
}) {
  return (
    <ListPageShell
      header={<PageHeader title={title} description={description} />}
      filters={
        <ConsoleFilterBar>
          <input className="rounded-2xl border px-4 py-3 text-sm" placeholder="사용자 검색" />
          <select className="rounded-2xl border px-4 py-3 text-sm">
            <option>전체 상태</option>
            <option>ACTIVE</option>
            <option>TEMPORARY</option>
          </select>
          <div />
          <div />
        </ConsoleFilterBar>
      }
      table={
        <DataTable
          headers={['Name', 'Email', 'Phone', 'Role', 'Status']}
          rows={items.map((item) => [
            item.name,
            item.email ?? '-',
            item.phone ?? '-',
            item.roleLabel,
            item.status ?? '-',
          ])}
        />
      }
    />
  );
}