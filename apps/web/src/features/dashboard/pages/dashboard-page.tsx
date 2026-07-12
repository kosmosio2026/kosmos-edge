'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useAuth } from '@/components/providers/auth-provider';
import { useRealtime } from '@/components/providers/realtime-provider';

import {
  fetchBillingSummary,
  fetchDisplayBoards,
  fetchParkingLots,
} from '@/lib/fetchers';

import { apiFetch } from '@/lib/api-client';

type Props = {
  role?: 'admin' | 'manager' | 'operator';
};

type ParkingLot = {
  id?: string;
  code?: string;
  name?: string;
  region?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  centerLat?: number | null;
  centerLng?: number | null;
  _count?: {
    spaces?: number;
    sections?: number;
  };
  spaces?: ParkingSpace[];
  sections?: ParkingSection[];
};

type ParkingSection = {
  id?: string;
  name?: string;
  code?: string;
  parkingLotId?: string;
};

type ParkingSpace = {
  id: string;
  code?: string;
  status?: 'EMPTY' | 'AVAILABLE' | 'OCCUPIED' | 'VIOLATION' | string;
  sectionId?: string | null;
  section?: {
    id?: string;
    name?: string;
    code?: string;
    parkingLotId?: string;
    parkingLot?: ParkingLot;
  } | null;
};

type DisplayBoard = {
  id?: string;
  parkingLotId?: string;
  parkingLotName?: string;
  name?: string;
  summary?: {
    availableSpaces?: number;
    totalSpaces?: number;
  };
};

type BillingSummary = {
  todayRevenue?: number;
  today?: {
    revenue?: number;
  };
  lotRevenue?: Array<{
    parkingLotId?: string;
    parkingLotName?: string;
    revenue?: number;
    todayRevenue?: number;
    totalRevenue?: number;
  }>;
};

const PAGE_SIZE = 10;
const DEFAULT_REGION = 'SEOUL';

function toArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (value && typeof value === 'object') {
    const obj = value as { items?: unknown; data?: unknown };

    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];

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

function unwrapData<T>(value: unknown, fallback: T): T {
  if (value && typeof value === 'object' && 'data' in value) {
    return ((value as { data?: T }).data ?? fallback) as T;
  }

  return (value ?? fallback) as T;
}

function normalizeRegion(value?: string | null) {
  return (value ?? '').trim().toUpperCase();
}

function isOccupied(space: ParkingSpace) {
  return space.status === 'OCCUPIED';
}

function isAvailable(space: ParkingSpace) {
  return (
    space.status === 'EMPTY' ||
    space.status === 'AVAILABLE' ||
    !space.status
  );
}

function getLotIdFromSpace(space: ParkingSpace) {
  return space.section?.parkingLotId ?? space.section?.parkingLot?.id ?? null;
}

function getLotName(lot: ParkingLot) {
  return lot.name ?? lot.code ?? '-';
}

function formatMoney(value?: number | null) {
  return `₩ ${Number(value ?? 0).toLocaleString()}`;
}

function getPageCount(total: number) {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

function pageItems<T>(items: T[], page: number) {
  const start = page * PAGE_SIZE;
  return items.slice(start, start + PAGE_SIZE);
}

export default function DashboardPage({ role = 'admin' }: Props) {
  const { session } = useAuth();
  const { lastEvent } = useRealtime();

  const [lots, setLots] = useState<ParkingLot[]>([]);
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [displayBoards, setDisplayBoards] = useState<DisplayBoard[]>([]);
  const [spaces, setSpaces] = useState<ParkingSpace[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [capacityRegion, setCapacityRegion] = useState(DEFAULT_REGION);
  const [displayRegion, setDisplayRegion] = useState(DEFAULT_REGION);
  const [mapRegion, setMapRegion] = useState(DEFAULT_REGION);

  const [capacityPage, setCapacityPage] = useState(0);
  const [displayPage, setDisplayPage] = useState(0);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setError(null);

    const results = await Promise.allSettled([
      fetchParkingLots(session.accessToken),
      fetchBillingSummary(session.accessToken),
      fetchDisplayBoards(session.accessToken),
      apiFetch('/facilities/spaces', {
        accessToken: session.accessToken,
      }),
    ]);

    const [lotsResult, billingResult, displayResult, spacesResult] = results;

    if (lotsResult.status === 'fulfilled') {
      setLots(toArray<ParkingLot>(lotsResult.value));
    }

    if (billingResult.status === 'fulfilled') {
      setBilling(unwrapData<BillingSummary | null>(billingResult.value, null));
    }

    if (displayResult.status === 'fulfilled') {
      setDisplayBoards(toArray<DisplayBoard>(displayResult.value));
    }

    if (spacesResult.status === 'fulfilled') {
      setSpaces(toArray<ParkingSpace>(spacesResult.value));
    }

    const failedCount = results.filter((r) => r.status === 'rejected').length;

    if (failedCount > 0) {
      setError(`${failedCount} dashboard endpoint(s) failed.`);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const reloadEvents = new Set([
      'parking.entry',
      'parking.exit',
      'parking.update',
      'parking.session.created',
      'parking.session.closed',
      'payment.updated',
      'display.data.updated',
    ]);

    if (lastEvent?.event && reloadEvents.has(lastEvent.event)) {
      void load();
    }
  }, [lastEvent, load]);

  const regions = useMemo(() => {
    const values = lots
      .map((lot) => normalizeRegion(lot.region))
      .filter(Boolean);

    const unique = Array.from(new Set(values));

    if (!unique.includes(DEFAULT_REGION)) {
      unique.unshift(DEFAULT_REGION);
    }

    return unique;
  }, [lots]);

  const lotsById = useMemo(() => {
    return new Map(lots.map((lot) => [lot.id, lot]));
  }, [lots]);

  const spacesByLotId = useMemo(() => {
    const map = new Map<string, ParkingSpace[]>();

    spaces.forEach((space) => {
      const lotId = getLotIdFromSpace(space);
      if (!lotId) return;

      const current = map.get(lotId) ?? [];
      current.push(space);
      map.set(lotId, current);
    });

    return map;
  }, [spaces]);

  const sectionsByLotId = useMemo(() => {
    const map = new Map<string, ParkingSection[]>();

    spaces.forEach((space) => {
      const lotId = getLotIdFromSpace(space);
      const section = space.section;
      if (!lotId || !section?.id) return;

      const current = map.get(lotId) ?? [];
      if (!current.some((item) => item.id === section.id)) {
        current.push({
          id: section.id,
          name: section.name,
          code: section.code,
          parkingLotId: lotId,
        });
      }

      map.set(lotId, current);
    });

    return map;
  }, [spaces]);

  const totalSpaces = spaces.length;

  const occupiedSpaces = useMemo(() => {
    return spaces.filter(isOccupied).length;
  }, [spaces]);

  const occupancyRate =
    totalSpaces > 0 ? Math.round((occupiedSpaces / totalSpaces) * 100) : 0;

  const todayRevenue = Number(
    billing?.todayRevenue ?? billing?.today?.revenue ?? 0,
  );

  const revenueByLotId = useMemo(() => {
    const map = new Map<string, number>();

    billing?.lotRevenue?.forEach((item) => {
      if (!item.parkingLotId) return;

      map.set(
        item.parkingLotId,
        Number(item.todayRevenue ?? item.totalRevenue ?? item.revenue ?? 0),
      );
    });

    return map;
  }, [billing]);

  const capacityLots = useMemo(() => {
    return lots.filter((lot) => normalizeRegion(lot.region) === capacityRegion);
  }, [lots, capacityRegion]);

  const displayLots = useMemo(() => {
    return lots.filter((lot) => normalizeRegion(lot.region) === displayRegion);
  }, [lots, displayRegion]);

  const mapLots = useMemo(() => {
    return lots.filter((lot) => normalizeRegion(lot.region) === mapRegion);
  }, [lots, mapRegion]);

  const capacityPageCount = getPageCount(capacityLots.length);
  const displayPageCount = getPageCount(displayLots.length);

  const visibleCapacityLots = pageItems(capacityLots, capacityPage);
  const visibleDisplayLots = pageItems(displayLots, displayPage);

  const capacityChartData = useMemo(() => {
    return visibleCapacityLots.map((lot) => {
      const lotSpaces =
        lot.id && spacesByLotId.has(lot.id)
          ? spacesByLotId.get(lot.id) ?? []
          : lot.spaces ?? [];

      const lotSections =
        lot.id && sectionsByLotId.has(lot.id)
          ? sectionsByLotId.get(lot.id) ?? []
          : lot.sections ?? [];

      return {
        name: getLotName(lot),
        spaces: lot._count?.spaces ?? lotSpaces.length ?? 0,
        sections: lot._count?.sections ?? lotSections.length ?? 0,
      };
    });
  }, [visibleCapacityLots, spacesByLotId, sectionsByLotId]);

  const displayStats = useMemo(() => {
    return visibleDisplayLots.map((lot) => {
      const lotSpaces =
        lot.id && spacesByLotId.has(lot.id)
          ? spacesByLotId.get(lot.id) ?? []
          : lot.spaces ?? [];

      const lotSections =
        lot.id && sectionsByLotId.has(lot.id)
          ? sectionsByLotId.get(lot.id) ?? []
          : lot.sections ?? [];

      const board = displayBoards.find(
        (item) =>
          item.parkingLotId === lot.id ||
          item.parkingLotName === lot.name ||
          item.name === lot.name,
      );

      const sectionAvailability = lotSections.map((section) => {
        const sectionSpaces = lotSpaces.filter(
          (space) => space.sectionId === section.id || space.section?.id === section.id,
        );

        return {
          sectionName: section.name ?? section.code ?? '-',
          available: sectionSpaces.filter(isAvailable).length,
          total: sectionSpaces.length,
        };
      });

      return {
        lotId: lot.id,
        lotName: getLotName(lot),
        totalSpaces:
          board?.summary?.totalSpaces ??
          lot._count?.spaces ??
          lotSpaces.length,
        availableSpaces:
          board?.summary?.availableSpaces ??
          lotSpaces.filter(isAvailable).length,
        sectionAvailability,
        revenue: lot.id ? revenueByLotId.get(lot.id) ?? 0 : 0,
      };
    });
  }, [
    visibleDisplayLots,
    spacesByLotId,
    sectionsByLotId,
    displayBoards,
    revenueByLotId,
  ]);

  const selectedLot = selectedLotId ? lotsById.get(selectedLotId) : null;
  const selectedLotSpaces =
    selectedLotId && spacesByLotId.has(selectedLotId)
      ? spacesByLotId.get(selectedLotId) ?? []
      : [];

  useEffect(() => {
    setCapacityPage(0);
  }, [capacityRegion]);

  useEffect(() => {
    setDisplayPage(0);
  }, [displayRegion]);

  useEffect(() => {
    setSelectedLotId(null);
  }, [mapRegion]);

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>

        <p className="text-sm text-slate-500">
          {role === 'admin' ? '전체 운영 현황' : '권한 범위 내 운영 현황'}
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <Metric title="Parking Lots" value={lots.length} />
        <Metric title="Total Spaces" value={totalSpaces} />
        <Metric title="Occupancy" value={`${occupancyRate}%`} />
        <Metric title="Today Revenue" value={formatMoney(todayRevenue)} />
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <SectionHeader
          title="Lot Capacity"
          region={capacityRegion}
          regions={regions}
          onRegionChange={setCapacityRegion}
          page={capacityPage}
          pageCount={capacityPageCount}
          onPrev={() => setCapacityPage((page) => Math.max(0, page - 1))}
          onNext={() =>
            setCapacityPage((page) => Math.min(capacityPageCount - 1, page + 1))
          }
        />

        {capacityChartData.length > 0 ? (
          <div className="h-[360px] w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={300}>
              <BarChart data={capacityChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="spaces" name="Total Spaces" />
                <Bar dataKey="sections" name="Sections" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyBox message="No parking lot data." />
        )}
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <SectionHeader
          title="Display Boards"
          region={displayRegion}
          regions={regions}
          onRegionChange={setDisplayRegion}
          page={displayPage}
          pageCount={displayPageCount}
          onPrev={() => setDisplayPage((page) => Math.max(0, page - 1))}
          onNext={() =>
            setDisplayPage((page) => Math.min(displayPageCount - 1, page + 1))
          }
        />

        {displayStats.length > 0 ? (
          <div className="grid gap-4 xl:grid-cols-2">
            {displayStats.map((item) => (
              <div key={item.lotId ?? item.lotName} className="rounded-2xl border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold">{item.lotName}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      Available {item.availableSpaces} / Total {item.totalSpaces}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-slate-500">Revenue</div>
                    <div className="font-bold">{formatMoney(item.revenue)}</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {item.sectionAvailability.map((section) => (
                    <div
                      key={section.sectionName}
                      className="rounded-xl bg-slate-50 px-3 py-2 text-sm"
                    >
                      <div className="font-medium">{section.sectionName}</div>
                      <div className="text-slate-500">
                        Available {section.available} / {section.total}
                      </div>
                    </div>
                  ))}

                  {item.sectionAvailability.length === 0 ? (
                    <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">
                      No section data.
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyBox message="No display board data." />
        )}
      </section>

      <section className="rounded-3xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">Live Parking Map</h2>
            <p className="text-sm text-slate-500">
              Kakao map marker area. Select a marker/lot to view coded spaces.
            </p>
          </div>

          <RegionSelect
            value={mapRegion}
            regions={regions}
            onChange={setMapRegion}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="min-h-[420px] rounded-2xl border bg-slate-50 p-4">
            <div className="mb-3 text-sm font-medium text-slate-600">
              Parking Lot Markers
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {mapLots.map((lot) => {
                const lotSpaces = lot.id ? spacesByLotId.get(lot.id) ?? [] : [];
                const occupied = lotSpaces.filter(isOccupied).length;
                const total = lotSpaces.length;

                return (
                  <button
                    key={lot.id ?? lot.name}
                    type="button"
                    onClick={() => setSelectedLotId(lot.id ?? null)}
                    className={[
                      'rounded-2xl border bg-white p-4 text-left shadow-sm hover:border-blue-400',
                      selectedLotId === lot.id ? 'border-blue-500' : '',
                    ].join(' ')}
                  >
                    <div className="font-semibold">{getLotName(lot)}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {lot.address ?? lot.region ?? '-'}
                    </div>
                    <div className="mt-3 text-sm">
                      Occupied {occupied} / {total}
                    </div>
                  </button>
                );
              })}

              {mapLots.length === 0 ? (
                <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 md:col-span-2">
                  No parking lots in this region.
                </div>
              ) : null}
            </div>
          </div>

          <div className="min-h-[420px] rounded-2xl border p-4">
            <div className="mb-3">
              <div className="font-semibold">
                {selectedLot ? getLotName(selectedLot) : 'Select parking lot'}
              </div>
              <div className="text-sm text-slate-500">
                {selectedLot
                  ? 'Coded parking spaces'
                  : 'Select a marker to expand parking spaces.'}
              </div>
            </div>

            {selectedLot ? (
              <div className="grid grid-cols-6 gap-2">
                {selectedLotSpaces.map((space) => (
                  <div
                    key={space.id}
                    title={`${space.code ?? space.id} · ${space.status ?? '-'}`}
                    className={[
                      'flex h-10 items-center justify-center rounded-lg text-[11px] font-medium text-white',
                      space.status === 'OCCUPIED'
                        ? 'bg-slate-600'
                        : space.status === 'VIOLATION'
                          ? 'bg-red-500'
                          : 'bg-emerald-500',
                    ].join(' ')}
                  >
                    {space.code ?? '-'}
                  </div>
                ))}

                {selectedLotSpaces.length === 0 ? (
                  <div className="col-span-6 rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-500">
                    No parking space data.
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex h-[320px] items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500">
                No parking lot selected.
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function Metric({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}

function RegionSelect({
  value,
  regions,
  onChange,
}: {
  value: string;
  regions: string[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-xl border px-3 py-2 text-sm"
    >
      {regions.map((region) => (
        <option key={region} value={region}>
          {region}
        </option>
      ))}
    </select>
  );
}

function SectionHeader({
  title,
  region,
  regions,
  onRegionChange,
  page,
  pageCount,
  onPrev,
  onNext,
}: {
  title: string;
  region: string;
  regions: string[];
  onRegionChange: (value: string) => void;
  page: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-bold">{title}</h2>

      <div className="flex items-center gap-2">
        <RegionSelect value={region} regions={regions} onChange={onRegionChange} />

        <button
          type="button"
          onClick={onPrev}
          disabled={page <= 0}
          className="rounded-xl border px-3 py-2 text-sm disabled:opacity-40"
        >
          ←
        </button>

        <div className="text-sm text-slate-500">
          {page + 1} / {pageCount}
        </div>

        <button
          type="button"
          onClick={onNext}
          disabled={page >= pageCount - 1}
          className="rounded-xl border px-3 py-2 text-sm disabled:opacity-40"
        >
          →
        </button>
      </div>
    </div>
  );
}

function EmptyBox({ message }: { message: string }) {
  return (
    <div className="flex h-[320px] items-center justify-center rounded-2xl bg-slate-50 text-sm text-slate-500">
      {message}
    </div>
  );
}