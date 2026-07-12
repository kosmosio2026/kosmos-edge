'use client';

import { useState } from 'react';
import type { ApprovalItem } from '@/types/admin';
import type { PaginationMeta } from '@/types/pagination';
import { ListPageShell } from '@/components/console/list-page-shell';
import { PageHeader } from '@/components/console/page-header';
import { DataTable } from '@/components/console/data-table';
import { DetailDrawer } from '@/components/console/detail-drawer';
import { TableToolbar } from '@/components/console/table-toolbar';
import { PaginationBar } from '@/components/console/pagination-bar';

export function ApprovalListPage({
  title,
  description,
  initialItems,
  pagination,
}: {
  title: string;
  description: string;
  initialItems: ApprovalItem[];
  pagination: PaginationMeta;
}) {
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState<ApprovalItem | null>(null);
  const [loading, setLoading] = useState(false);

  async function doAction(action: 'approve' | 'reject') {
    if (!selected) return;
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/approvals/${selected.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? 'Action failed');
      }

      setItems((prev) =>
        prev.map((item) =>
          item.id === selected.id
            ? { ...item, status: action === 'approve' ? 'APPROVED' : 'REJECTED' }
            : item,
        ),
      );
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <ListPageShell
        header={<PageHeader title={title} description={description} />}
        filters={<TableToolbar searchPlaceholder="승인 요청 검색" />}
        table={
          <>
            <DataTable
              headers={[
                'Type',
                'Applicant',
                'Email',
                'Phone',
                'Parking Lot',
                'Section',
                'Status',
                'Created',
                'Action',
              ]}
              rows={items.map((item) => [
                item.type,
                item.applicantName,
                item.applicantEmail ?? '-',
                item.applicantPhone ?? '-',
                item.parkingLotName ?? '-',
                item.parkingSectionName ?? '-',
                item.status,
                item.createdAt,
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
        title={selected?.applicantName ?? ''}
        subtitle={selected?.type}
        onClose={() => setSelected(null)}
      >
        <div className="space-y-2 text-sm text-slate-600">
          <div>이메일: {selected?.applicantEmail ?? '-'}</div>
          <div>전화번호: {selected?.applicantPhone ?? '-'}</div>
          <div>주차장: {selected?.parkingLotName ?? '-'}</div>
          <div>구역: {selected?.parkingSectionName ?? '-'}</div>
        </div>

        <div className="flex gap-3">
          <button
            disabled={loading}
            onClick={() => void doAction('reject')}
            className="flex-1 rounded-2xl border px-4 py-3 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Reject
          </button>
          <button
            disabled={loading}
            onClick={() => void doAction('approve')}
            className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white disabled:opacity-50"
          >
            Approve
          </button>
        </div>
      </DetailDrawer>
    </>
  );
}