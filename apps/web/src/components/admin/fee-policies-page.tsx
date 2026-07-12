'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FeePolicyItem } from '@/types/admin';
import { emitToast } from '@/lib/toast-bus';
import { ListPageShell } from '@/components/console/list-page-shell';
import { PageHeader } from '@/components/console/page-header';
import { DataTable } from '@/components/console/data-table';
import { EntityFormModal } from './entity-form-modal';
import { TableToolbar } from '@/components/console/table-toolbar';
import { PaginationBar } from '@/components/console/pagination-bar';
import type { PaginationMeta } from '@/types/pagination';

export function FeePoliciesPage({
  initialItems,
  pagination,
}: {
  initialItems: FeePolicyItem[];
  pagination: PaginationMeta;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<FeePolicyItem | null>(null);

  async function createItem(values: Record<string, unknown>) {
    const response = await fetch('/api/admin/fee-policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.message ?? 'Create failed');

    setItems((prev) => [result.data ?? (values as FeePolicyItem), ...prev]);
    setCreateOpen(false);
    emitToast({
      title: 'Fee policy created',
      variant: 'success',
    });
    router.refresh();
  }

  async function updateItem(values: Record<string, unknown>) {
    if (!selected) return;

    const response = await fetch(`/api/admin/fee-policies/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.message ?? 'Update failed');

    setItems((prev) =>
      prev.map((item) => (item.id === selected.id ? { ...item, ...values } as FeePolicyItem : item)),
    );
    emitToast({
      title: 'Fee policy updated',
      description: selected.name,
      variant: 'success',
    });
    setSelected(null);
    router.refresh();
  }

  return (
    <>
      <ListPageShell
        header={
          <PageHeader
            title="Fee Policies"
            description="요금 정책 관리"
            actions={
              <button
                onClick={() => setCreateOpen(true)}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white"
              >
                Create
              </button>
            }
          />
        }
        filters={<TableToolbar searchPlaceholder="요금 정책 검색" />}
        table={
          <>
            <DataTable
              headers={['Name', 'Code', 'Lot', 'Base', 'Unit', 'Active', 'Action']}
              rows={items.map((item) => [
                item.name,
                item.code,
                item.lotName ?? '-',
                `${item.baseMinutes}m / ${item.baseFee}`,
                `${item.unitMinutes}m / ${item.unitFee}`,
                item.isActive ? 'YES' : 'NO',
                <button
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className="rounded-xl border px-3 py-2 text-xs hover:bg-slate-50"
                >
                  Edit
                </button>,
              ])}
            />
            <PaginationBar meta={pagination} />
          </>
        }
      />

      <EntityFormModal
        open={createOpen}
        title="Create Fee Policy"
        defaultValues={{
          name: '',
          code: '',
          baseMinutes: 30,
          baseFee: 2000,
          unitMinutes: 10,
          unitFee: 500,
          isActive: true,
        }}
        fields={[
          { name: 'name', label: 'Name', required: true },
          { name: 'code', label: 'Code', required: true },
          { name: 'baseMinutes', label: 'Base Minutes', type: 'number', required: true, min: 1 },
          { name: 'baseFee', label: 'Base Fee', type: 'number', required: true, min: 0 },
          { name: 'unitMinutes', label: 'Unit Minutes', type: 'number', required: true, min: 1 },
          { name: 'unitFee', label: 'Unit Fee', type: 'number', required: true, min: 0 },
          { name: 'isActive', label: 'Active', type: 'checkbox' },
        ]}
        onClose={() => setCreateOpen(false)}
        onSubmit={createItem}
      />

      <EntityFormModal
        open={!!selected}
        title="Edit Fee Policy"
        defaultValues={
          selected ?? {
            name: '',
            code: '',
            baseMinutes: 30,
            baseFee: 2000,
            unitMinutes: 10,
            unitFee: 500,
            isActive: true,
          }
        }
        fields={[
          { name: 'name', label: 'Name', required: true },
          { name: 'code', label: 'Code', required: true },
          { name: 'baseMinutes', label: 'Base Minutes', type: 'number', required: true, min: 1 },
          { name: 'baseFee', label: 'Base Fee', type: 'number', required: true, min: 0 },
          { name: 'unitMinutes', label: 'Unit Minutes', type: 'number', required: true, min: 1 },
          { name: 'unitFee', label: 'Unit Fee', type: 'number', required: true, min: 0 },
          { name: 'isActive', label: 'Active', type: 'checkbox' },
        ]}
        onClose={() => setSelected(null)}
        onSubmit={updateItem}
      />
    </>
  );
}