'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ListPageShell } from '@/components/console/list-page-shell';
import { PageHeader } from '@/components/console/page-header';
import { DataTable } from '@/components/console/data-table';
import { DetailDrawer } from '@/components/console/detail-drawer';
import { EntityFormModal } from './entity-form-modal';
import { TableToolbar } from '@/components/console/table-toolbar';
import { PaginationBar } from '@/components/console/pagination-bar';
import type { PaginationMeta } from '@/types/pagination';

type CrudItem = Record<string, any>;

export function FacilitiesCrudPage({
  entity,
  title,
  description,
  headers,
  initialItems,
  formFields,
  rowBuilder,
  titleBuilder,
  pagination,
}: {
  entity: 'lots' | 'sections' | 'spaces';
  title: string;
  description: string;
  headers: string[];
  initialItems: CrudItem[];
  formFields: Array<{ name: string; label: string; type?: 'text' | 'number' | 'checkbox' }>;
  rowBuilder: (item: CrudItem) => React.ReactNode[];
  titleBuilder: (item: CrudItem) => string;
  pagination: PaginationMeta;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState<CrudItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const emptyDefaults = useMemo(
    () =>
      Object.fromEntries(
        formFields.map((field) => [field.name, field.type === 'checkbox' ? false : '']),
      ),
    [formFields],
  );

  async function createItem(values: CrudItem) {
    const response = await fetch(`/api/admin/facilities/${entity}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.message ?? 'Create failed');

    setItems((prev) => [result.data ?? values, ...prev]);
    setCreateOpen(false);
    router.refresh();
  }

  async function updateItem(values: CrudItem) {
    if (!selected?.id) return;

    const response = await fetch(`/api/admin/facilities/${entity}/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.message ?? 'Update failed');

    setItems((prev) =>
      prev.map((item) => (item.id === selected.id ? { ...item, ...values } : item)),
    );
    setEditOpen(false);
    setSelected(null);
    router.refresh();
  }

  async function deleteItem() {
    if (!selected?.id) return;

    const response = await fetch(`/api/admin/facilities/${entity}/${selected.id}`, {
      method: 'DELETE',
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.message ?? 'Delete failed');

    setItems((prev) => prev.filter((item) => item.id !== selected.id));
    setSelected(null);
    router.refresh();
  }

  return (
    <>
      <ListPageShell
        header={
          <PageHeader
            title={title}
            description={description}
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
        filters={<TableToolbar searchPlaceholder={`${title} 검색`} />}
        table={
          <>
            <DataTable
              headers={[...headers, 'Action']}
              rows={items.map((item) => [
                ...rowBuilder(item),
                <button
                  key={item.id}
                  onClick={() => setSelected(item)}
                  className="rounded-xl border px-3 py-2 text-xs hover:bg-slate-50"
                >
                  Detail
                </button>,
              ])}
            />
            <PaginationBar meta={pagination} />
          </>
        }
      />

      <DetailDrawer
        open={!!selected}
        title={selected ? titleBuilder(selected) : ''}
        onClose={() => setSelected(null)}
      >
        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          수정 또는 삭제를 진행하세요.
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => void deleteItem()}
            className="flex-1 rounded-2xl border px-4 py-3 text-sm hover:bg-slate-50"
          >
            Delete
          </button>
          <button
            onClick={() => setEditOpen(true)}
            className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white"
          >
            Edit
          </button>
        </div>
      </DetailDrawer>

      <EntityFormModal
        open={createOpen}
        title={`Create ${title}`}
        defaultValues={emptyDefaults}
        fields={formFields}
        onClose={() => setCreateOpen(false)}
        onSubmit={createItem}
      />

      <EntityFormModal
        open={editOpen}
        title={`Edit ${title}`}
        defaultValues={selected ?? emptyDefaults}
        fields={formFields}
        onClose={() => setEditOpen(false)}
        onSubmit={updateItem}
      />
    </>
  );
}