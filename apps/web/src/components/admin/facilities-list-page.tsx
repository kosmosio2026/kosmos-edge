'use client';

import { useState } from 'react';
import { ListPageShell } from '@/components/console/list-page-shell';
import { PageHeader } from '@/components/console/page-header';
import { ConsoleFilterBar } from '@/components/console/filter-bar';
import { DataTable } from '@/components/console/data-table';
import { DetailDrawer } from '@/components/console/detail-drawer';
import type {
  FacilityLotItem,
  FacilitySectionItem,
  FacilitySpaceItem,
} from '@/types/admin';

type Item = FacilityLotItem | FacilitySectionItem | FacilitySpaceItem;

export function FacilitiesListPage({
  title,
  description,
  headers,
  rows,
  selectedTitle,
  selectedSubtitle,
}: {
  title: string;
  description: string;
  headers: string[];
  rows: Array<{ key: string; values: React.ReactNode[]; item: Item }>;
  selectedTitle: (item: Item) => string;
  selectedSubtitle?: (item: Item) => string | undefined;
}) {
  const [selected, setSelected] = useState<Item | null>(null);

  return (
    <>
      <ListPageShell
        header={
          <PageHeader
            title={title}
            description={description}
            actions={
              <button className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white">
                Create
              </button>
            }
          />
        }
        filters={
          <ConsoleFilterBar>
            <input className="rounded-2xl border px-4 py-3 text-sm" placeholder="검색" />
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
            headers={[...headers, 'Action']}
            rows={rows.map((row) => [
              ...row.values,
              <button
                key={row.key}
                onClick={() => setSelected(row.item)}
                className="rounded-xl border px-3 py-2 text-xs hover:bg-slate-50"
              >
                Detail
              </button>,
            ])}
          />
        }
      />

      <DetailDrawer
        open={!!selected}
        title={selected ? selectedTitle(selected) : ''}
        subtitle={selected && selectedSubtitle ? selectedSubtitle(selected) : undefined}
        onClose={() => setSelected(null)}
      >
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          상세 정보 및 수정 폼 영역
        </div>
        <div className="flex gap-3">
          <button className="flex-1 rounded-2xl border px-4 py-3 text-sm hover:bg-slate-50">
            Delete
          </button>
          <button className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white">
            Save
          </button>
        </div>
      </DetailDrawer>
    </>
  );
}