import { ListPageShell } from '@/components/console/list-page-shell';
import { PageHeader } from '@/components/console/page-header';
import { ConsoleFilterBar } from '@/components/console/filter-bar';
import { DataTable } from '@/components/console/data-table';
import type { FeePolicyItem } from '@/types/admin';

export function FeesListPage({ items }: { items: FeePolicyItem[] }) {
  return (
    <ListPageShell
      header={
        <PageHeader
          title="Fee Policies"
          description="요금 정책 관리"
          actions={
            <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white">
              Create
            </button>
          }
        />
      }
      filters={
        <ConsoleFilterBar>
          <input className="rounded-2xl border px-4 py-3 text-sm" placeholder="요금 검색" />
          <select className="rounded-2xl border px-4 py-3 text-sm">
            <option>전체 상태</option>
            <option>ACTIVE</option>
            <option>INACTIVE</option>
          </select>
          <div />
          <div />
        </ConsoleFilterBar>
      }
      table={
        <DataTable
          headers={['Name', 'Code', 'Lot', 'Base', 'Unit', 'Active']}
          rows={items.map((item) => [
            item.name,
            item.code,
            item.lotName ?? '-',
            `${item.baseMinutes}m / ${item.baseFee}`,
            `${item.unitMinutes}m / ${item.unitFee}`,
            item.isActive ? 'YES' : 'NO',
          ])}
        />
      }
    />
  );
}