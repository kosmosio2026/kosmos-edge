'use client';

import { useState } from 'react';
import { ListPageShell } from '@/components/console/list-page-shell';
import { PageHeader } from '@/components/console/page-header';
import { ConsoleFilterBar } from '@/components/console/filter-bar';
import { DataTable } from '@/components/console/data-table';
import { DetailDrawer } from '@/components/console/detail-drawer';
import type { DeviceFaultItem, DeviceItem } from '@/types/admin';

type Item = DeviceItem | DeviceFaultItem;

export function DevicesListPage({
  title,
  description,
  headers,
  rows,
  selectedTitle,
}: {
  title: string;
  description: string;
  headers: string[];
  rows: Array<{ key: string; values: React.ReactNode[]; item: Item }>;
  selectedTitle: (item: Item) => string;
}) {
  const [selected, setSelected] = useState<Item | null>(null);

  return (
    <>
      <ListPageShell
        header={<PageHeader title={title} description={description} />}
        filters={
          <ConsoleFilterBar>
            <input className="rounded-2xl border px-4 py-3 text-sm" placeholder="장치 검색" />
            <select className="rounded-2xl border px-4 py-3 text-sm">
              <option>전체 상태</option>
              <option>ACTIVE</option>
              <option>OPEN</option>
              <option>IN_PROGRESS</option>
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
        onClose={() => setSelected(null)}
      >
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          장치 상세 / 장애 조치 입력 영역
        </div>
        <div className="flex gap-3">
          <button className="flex-1 rounded-2xl border px-4 py-3 text-sm hover:bg-slate-50">
            In Progress
          </button>
          <button className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white">
            Resolve
          </button>
        </div>
      </DetailDrawer>
    </>
  );
}