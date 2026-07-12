'use client';

import { useEffect, useState } from 'react';
import { DetailDrawer } from '@/components/console/detail-drawer';
import { DataTable } from '@/components/console/data-table';
import type { UserListItem } from '@/types/admin';

type ScopeOptions = {
  lots: Array<{ id: string; name: string }>;
  sections: Array<{ id: string; name: string; parkingLotName: string }>;
};

export function UsersDetailPage({
  title,
  description,
  initialItems,
  scopeOptions,
}: {
  title: string;
  description: string;
  initialItems: UserListItem[];
  scopeOptions: ScopeOptions;
}) {
  const [items] = useState(initialItems);
  const [selected, setSelected] = useState<UserListItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [scopes, setScopes] = useState({
    parkingLotIds: [] as string[],
    parkingSectionIds: [] as string[],
  });

  useEffect(() => {
    if (!selected) return;

    let cancelled = false;

    async function loadDetail() {
  if (!selected) return;

  const current = selected; // ✅ snapshot

  setLoading(true);
  try {
    const response = await fetch(
      `/api/admin/users/detail/${current.id}`
    );
        const result = await response.json();
        if (!cancelled && result.ok && result.data?.scopes) {
          setScopes({
            parkingLotIds: result.data.scopes.parkingLotIds ?? [],
            parkingSectionIds: result.data.scopes.parkingSectionIds ?? [],
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [selected]);

  async function saveScopes() {
    if (!selected) return;

    const response = await fetch(`/api/admin/users/scopes/${selected.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scopes),
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.message ?? 'Scope update failed');
    }

    setSelected(null);
  }

  function toggleLot(id: string) {
    setScopes((prev) => ({
      ...prev,
      parkingLotIds: prev.parkingLotIds.includes(id)
        ? prev.parkingLotIds.filter((v) => v !== id)
        : [...prev.parkingLotIds, id],
    }));
  }

  function toggleSection(id: string) {
    setScopes((prev) => ({
      ...prev,
      parkingSectionIds: prev.parkingSectionIds.includes(id)
        ? prev.parkingSectionIds.filter((v) => v !== id)
        : [...prev.parkingSectionIds, id],
    }));
  }

  return (
    <>
      <div className="space-y-6">
        <div className="rounded-3xl border bg-white p-6">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-slate-500">{description}</p>
        </div>

        <DataTable
          headers={['Name', 'Email', 'Phone', 'Role', 'Status', 'Action']}
          rows={items.map((item) => [
            item.name,
            item.email ?? '-',
            item.phone ?? '-',
            item.roleLabel,
            item.status ?? '-',
            <button
              key={item.id}
              onClick={() => setSelected(item)}
              className="rounded-xl border px-3 py-2 text-xs hover:bg-slate-50"
            >
              Detail
            </button>,
          ])}
        />
      </div>

      <DetailDrawer
        open={!!selected}
        title={selected?.name ?? ''}
        subtitle={selected?.roleLabel}
        onClose={() => setSelected(null)}
      >
        {loading ? <div className="text-sm text-slate-500">Loading...</div> : null}

        <div className="text-sm text-slate-600">Email: {selected?.email ?? '-'}</div>
        <div className="text-sm text-slate-600">Phone: {selected?.phone ?? '-'}</div>

        <div>
          <div className="mb-2 text-sm font-medium">Parking Lots</div>
          <div className="space-y-2">
            {scopeOptions.lots.map((lot) => (
              <label key={lot.id} className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={scopes.parkingLotIds.includes(lot.id)}
                  onChange={() => toggleLot(lot.id)}
                />
                <span>{lot.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-medium">Parking Sections</div>
          <div className="space-y-2">
            {scopeOptions.sections.map((section) => (
              <label key={section.id} className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={scopes.parkingSectionIds.includes(section.id)}
                  onChange={() => toggleSection(section.id)}
                />
                <span>{section.name}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={() => void saveScopes()}
          className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white"
        >
          Save Scope Binding
        </button>
      </DetailDrawer>
    </>
  );
}