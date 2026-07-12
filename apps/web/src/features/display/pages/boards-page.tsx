'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { fetchDisplayBoards } from '@/lib/fetchers';

type Role = 'admin' | 'manager' | 'operator';

type SectionSummary = {
  sectionId?: string;
  sectionName?: string;
  availableSpaces?: number;
  totalSpaces?: number;
};

type DisplayBoardItem = {
  id?: string;
  macAddress?: string | null;
  mac_address?: string | null;
  mac?: string | null;
  region?: string | null;
  parkingLotId?: string;
  parkingLotName?: string;
  parkingLotCode?: string;
  summary?: {
    totalSpaces?: number;
    occupiedSpaces?: number;
    availableSpaces?: number;
  };
  sections?: SectionSummary[];
};

type Props = {
  role?: Role;
};

const PAGE_SIZE = 10;

function unwrapList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (value && typeof value === 'object') {
    const obj = value as { data?: unknown; items?: unknown };

    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];

    if (
      obj.data &&
      typeof obj.data === 'object' &&
      Array.isArray((obj.data as { items?: unknown }).items)
    ) {
      return (obj.data as { items: T[] }).items;
    }
  }

  return [];
}

function getMac(item: DisplayBoardItem) {
  return item.macAddress ?? item.mac_address ?? item.mac ?? '-';
}

function getSectionText(section?: SectionSummary) {
  if (!section) return '-';

  const available = section.availableSpaces ?? 0;
  const total = section.totalSpaces;

  return total === undefined
    ? `${available} free`
    : `${available}/${total}`;
}

function getOccupancy(item: DisplayBoardItem) {
  const total = item.summary?.totalSpaces ?? 0;
  const occupied = item.summary?.occupiedSpaces ?? 0;

  if (total <= 0) return '0%';

  return `${Math.round((occupied / total) * 100)}%`;
}

function getBasePath(role: Role) {
  if (role === 'manager') return '/manager/display';
  if (role === 'operator') return '/operator/display';
  return '/admin/display';
}

export default function DisplayBoardsPage({ role = 'admin' }: Props) {
  const { session } = useAuth();
  const [items, setItems] = useState<DisplayBoardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const basePath = getBasePath(role);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);

    try {
      const res = await fetchDisplayBoards(session.accessToken);
      setItems(unwrapList<DisplayBoardItem>(res));
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, page]);

  return (
    <main className="space-y-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Display Boards</h1>
          <p className="text-sm text-slate-500">
            {role === 'admin'
              ? '전체 실시간 전광판 표시 데이터'
              : '권한 범위 내 실시간 전광판 표시 데이터'}
          </p>
        </div>

<div className="flex items-center gap-2">
  <Link
    href={`${basePath}/settings/new`}
    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
  >
    Add Display
  </Link>

  <button
    type="button"
    onClick={() => void load()}
    className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
  >
    Refresh
  </button>
</div>
      </header>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <Th>No</Th>
              <Th>Region</Th>
              <Th>Parking Lot</Th>
              <Th>MAC_Address</Th>
              <Th>Total Space</Th>
              <Th>Section1</Th>
              <Th>Section2</Th>
              <Th>Section3</Th>
              <Th>Section4</Th>
              <Th>Section5</Th>
              <Th>Occupancy</Th>
              <Th>Actions</Th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} className="px-5 py-10 text-center text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-5 py-10 text-center text-slate-500">
                  No display board data.
                </td>
              </tr>
            ) : (
              pageRows.map((item, index) => {
                const rowNumber = (page - 1) * PAGE_SIZE + index + 1;
                const sections = item.sections ?? [];
                const boardId = item.id ?? item.parkingLotId;

                return (
                  <tr key={boardId ?? rowNumber} className="border-t">
                    <Td>{rowNumber}</Td>
                    <Td>{item.region ?? '-'}</Td>
                    <Td>
                      <div className="font-medium">
                        {item.parkingLotName ?? '-'}
                      </div>
                      <div className="text-xs text-slate-500">
                        {item.parkingLotCode ?? '-'}
                      </div>
                    </Td>
                    <Td>{getMac(item)}</Td>
                    <Td>{item.summary?.totalSpaces ?? 0}</Td>
                    <Td>{getSectionText(sections[0])}</Td>
                    <Td>{getSectionText(sections[1])}</Td>
                    <Td>{getSectionText(sections[2])}</Td>
                    <Td>{getSectionText(sections[3])}</Td>
                    <Td>{getSectionText(sections[4])}</Td>
                    <Td>{getOccupancy(item)}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        {boardId ? (
                          <>
                            <Link
                              href={`${basePath}/${boardId}/settings`}
                              className="text-blue-600 hover:underline"
                            >
                              Settings
                            </Link>
                            <Link
                              href={`${basePath}/${boardId}/led-protocol`}
                              className="text-blue-600 hover:underline"
                            >
                              LED
                            </Link>
                          </>
                        ) : null}

                        <Link
                          href={`${basePath}/kiosk`}
                          className="text-blue-600 hover:underline"
                        >
                          Kiosk
                        </Link>
                        <Link
                          href={`${basePath}/monitoring`}
                          className="text-blue-600 hover:underline"
                        >
                          Monitoring
                        </Link>
                        <Link
                          href={`${basePath}/ad-editor`}
                          className="text-blue-600 hover:underline"
                        >
                          Ad
                        </Link>
                      </div>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="text-slate-500">
          Page {page} / {totalPages} · Total {items.length}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            className="rounded-lg border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            className="rounded-lg border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-5 py-3 font-medium">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-5 py-3 align-top">{children}</td>;
}