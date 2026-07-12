'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { emitToast } from '@/lib/toast-bus';
import { ListPageShell } from '@/components/console/list-page-shell';
import { PageHeader } from '@/components/console/page-header';
import { DataTable } from '@/components/console/data-table';
import { DetailDrawer } from '@/components/console/detail-drawer';
import { TableToolbar } from '@/components/console/table-toolbar';
import { PaginationBar } from '@/components/console/pagination-bar';
import type { DeviceFaultItem } from '@/types/admin';
import type { PaginationMeta } from '@/types/pagination';

export function DeviceFaultsPage({
  initialItems,
  pagination,
}: {
  initialItems: DeviceFaultItem[];
  pagination: PaginationMeta;
}) {
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState<DeviceFaultItem | null>(null);
  const { register, handleSubmit, reset } = useForm({
    defaultValues: {
      status: 'IN_PROGRESS',
      actionNote: '',
    },
  });

  async function onSubmit(values: Record<string, unknown>) {
    if (!selected) return;

    const response = await fetch(`/api/admin/device-faults/${selected.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.message ?? 'Action failed');

    setItems((prev) =>
      prev.map((item) =>
        item.id === selected.id ? { ...item, status: String(values.status) } : item,
      ),
    );
    emitToast({
      title: 'Fault updated',
      description: `${selected.deviceCode} 상태가 ${String(values.status)} 로 변경되었습니다.`,
      variant: 'success',
    });
    reset();
    setSelected(null);
  }

  return (
    <>
      <ListPageShell
        header={<PageHeader title="Device Faults" description="장애 관리" />}
        filters={<TableToolbar searchPlaceholder="장애/장치 검색" />}
        table={
          <>
            <DataTable
              headers={['Device', 'Lot', 'Section', 'Severity', 'Status', 'Reason', 'Created', 'Action']}
              rows={items.map((item) => [
                item.deviceCode,
                item.lotName ?? '-',
                item.sectionName ?? '-',
                item.severity,
                item.status,
                item.reason,
                item.createdAt,
                <button
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className="rounded-xl border px-3 py-2 text-xs hover:bg-slate-50"
                >
                  Action
                </button>,
              ])}
            />
            <PaginationBar meta={pagination} />
          </>
        }
      />

      <DetailDrawer
        open={!!selected}
        title={selected?.deviceCode ?? ''}
        subtitle={selected?.reason}
        onClose={() => setSelected(null)}
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div>
            <label className="mb-2 block text-sm font-medium">Status</label>
            <select className="w-full rounded-2xl border px-4 py-3 text-sm" {...register('status')}>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="RESOLVED">RESOLVED</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Action Note</label>
            <textarea
              className="w-full rounded-2xl border px-4 py-3 text-sm"
              rows={4}
              {...register('actionNote', {
                required: 'Action note is required',
                minLength: { value: 5, message: 'Minimum 5 characters' },
              })}
            />
          </div>

          <button className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white">
            Save Action
          </button>
        </form>
      </DetailDrawer>
    </>
  );
}