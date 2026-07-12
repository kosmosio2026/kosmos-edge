'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRealtime } from '@/components/providers/realtime-provider';
import { useAuth } from '@/components/providers/auth-provider';
import { getOperatorMapData } from '@/lib/api';
import type { ConsoleRole } from '@/lib/console-role';
import { asRecord, str, getRegion, getDistrict } from '@/lib/parking-live/region';
import type {
  OperatorMapResponse,
  ParkingLotMapItem,
  ParkingSpaceMapItem,
} from '@/types/operator';

type Props = {
  role?: ConsoleRole;
  title?: string;
  description?: string;
};

function getSpaceRegion(space: ParkingSpaceMapItem, lots: ParkingLotMapItem[]) {
  const direct = getRegion(space);
  if (direct !== 'All Regions') return direct;

  const lot = lots.find((item) => item.id === space.lotId);
  return lot ? getRegion(lot) : 'All Regions';
}

function getSpaceDistrict(space: ParkingSpaceMapItem, lots: ParkingLotMapItem[]) {
  const direct = getDistrict(space);
  if (direct !== 'All Districts') return direct;

  const lot = lots.find((item) => item.id === space.lotId);
  return lot ? getDistrict(lot) : 'All Districts';
}

function getSpaceLotName(space: ParkingSpaceMapItem, lots: ParkingLotMapItem[]) {
  const raw = asRecord(space);

  return (
    str(raw.lotName) ||
    str(raw.parkingLotName) ||
    lots.find((lot) => lot.id === space.lotId)?.name ||
    space.lotId ||
    '-'
  );
}

function getSpaceSectionName(space: ParkingSpaceMapItem) {
  const raw = asRecord(space);

  return (
    str(raw.sectionName) ||
    str(raw.parkingSectionName) ||
    str(raw.sectionCode) ||
    space.sectionId ||
    '-'
  );
}

function statusLabel(space: ParkingSpaceMapItem) {
  const raw = asRecord(space);

  return (
    str(raw.occupancyState) ||
    str(raw.status) ||
    str(raw.parkingStatus) ||
    '-'
  );
}

function statusClass(space: ParkingSpaceMapItem) {
  const value = statusLabel(space).toUpperCase();

  if (value.includes('VIOLATION')) return 'border-red-300 bg-red-50';
  if (value.includes('UNREGISTERED')) return 'border-red-300 bg-red-50';
  if (value.includes('OCCUPIED')) return 'border-orange-300 bg-orange-50';
  if (value.includes('FAULT') || value.includes('ERROR')) {
    return 'border-slate-400 bg-slate-100';
  }
  if (value.includes('EMPTY') || value.includes('AVAILABLE')) {
    return 'border-emerald-300 bg-emerald-50';
  }

  return 'border-slate-200 bg-white';
}

export function OperatorGridPage({
  role = 'operator',
  title = 'Grid',
  description = '주차면 상태를 그리드 형식으로 확인합니다.',
}: Props) {
  const { socket } = useRealtime();
  const { session } = useAuth();

  const [data, setData] = useState<OperatorMapResponse>({
    parkingLots: [],
    spaces: [],
  });
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [parkingLotId, setParkingLotId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const accessToken = session?.accessToken;

  const load = useCallback(async () => {
    if (!accessToken) return;

    setLoading(true);
    setError('');

    try {
      const result = await getOperatorMapData(accessToken);
      setData(result);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Failed to load grid data.',
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;

    const update = (spaceId: string, status: string) => {
      setData((prev) => ({
        ...prev,
        spaces: prev.spaces.map((space) =>
          space.id === spaceId
            ? {
                ...space,
                status,
                occupancyState: status,
              }
            : space,
        ),
      }));
    };

    socket.on('parking.entry', (payload) => {
      update(payload.parkingSpaceId, 'OCCUPIED');
    });

    socket.on('parking.exit', (payload) => {
      update(payload.parkingSpaceId, 'EMPTY');
    });

    socket.on('parking.violation', (payload) => {
      update(payload.parkingSpaceId, 'VIOLATION');
    });

    return () => {
      socket.off('parking.entry');
      socket.off('parking.exit');
      socket.off('parking.violation');
    };
  }, [socket]);

  const regions = useMemo(() => {
    const values = new Set<string>();

    data.parkingLots.forEach((lot) => {
      const value = getRegion(lot);
      if (value !== 'All Regions') values.add(value);
    });

    data.spaces.forEach((space) => {
      const value = getSpaceRegion(space, data.parkingLots);
      if (value !== 'All Regions') values.add(value);
    });

    return Array.from(values).sort();
  }, [data.parkingLots, data.spaces]);

  const districts = useMemo(() => {
    const values = new Set<string>();

    data.parkingLots.forEach((lot) => {
      if (region && getRegion(lot) !== region) return;

      const value = getDistrict(lot);
      if (value !== 'All Districts') values.add(value);
    });

    data.spaces.forEach((space) => {
      if (region && getSpaceRegion(space, data.parkingLots) !== region) return;

      const value = getSpaceDistrict(space, data.parkingLots);
      if (value !== 'All Districts') values.add(value);
    });

    return Array.from(values).sort();
  }, [data.parkingLots, data.spaces, region]);

  const lots = useMemo(() => {
    return data.parkingLots.filter((lot) => {
      if (region && getRegion(lot) !== region) return false;
      if (district && getDistrict(lot) !== district) return false;
      return true;
    });
  }, [data.parkingLots, region, district]);

  const sections = useMemo(() => {
    const map = new Map<string, string>();

    data.spaces.forEach((space) => {
      if (region && getSpaceRegion(space, data.parkingLots) !== region) return;
      if (district && getSpaceDistrict(space, data.parkingLots) !== district) return;
      if (parkingLotId && space.lotId !== parkingLotId) return;
      if (!space.sectionId) return;

      map.set(space.sectionId, getSpaceSectionName(space));
    });

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.parkingLots, data.spaces, parkingLotId, region, district]);

  const filteredSpaces = useMemo(() => {
    const q = search.trim().toLowerCase();

    return data.spaces.filter((space) => {
      if (region && getSpaceRegion(space, data.parkingLots) !== region) {
        return false;
      }

      if (district && getSpaceDistrict(space, data.parkingLots) !== district) {
        return false;
      }

      if (parkingLotId && space.lotId !== parkingLotId) {
        return false;
      }

      if (sectionId && space.sectionId !== sectionId) {
        return false;
      }

      if (q) {
        const lotName = getSpaceLotName(space, data.parkingLots);
        const sectionName = getSpaceSectionName(space);

        return (
          space.code.toLowerCase().includes(q) ||
          lotName.toLowerCase().includes(q) ||
          sectionName.toLowerCase().includes(q) ||
          statusLabel(space).toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [data.parkingLots, data.spaces, parkingLotId, search, sectionId, region, district]);

  const summary = useMemo(() => {
    const occupied = filteredSpaces.filter((space) =>
      statusLabel(space).toUpperCase().includes('OCCUPIED'),
    );
    const violations = filteredSpaces.filter((space) =>
      statusLabel(space).toUpperCase().includes('VIOLATION'),
    );
    const unregistered = filteredSpaces.filter((space) =>
      statusLabel(space).toUpperCase().includes('UNREGISTERED'),
    );

    return {
      total: filteredSpaces.length,
      occupied: occupied.length,
      violations: violations.length,
      unregistered: unregistered.length,
    };
  }, [filteredSpaces]);

  return (
    <main className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-slate-500">{description}</p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          className="rounded-2xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {role ? null : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border bg-white p-4 text-sm text-slate-500">
          Loading grid data...
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">Spaces</div>
          <div className="mt-2 text-3xl font-semibold">{summary.total}</div>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">Occupied</div>
          <div className="mt-2 text-3xl font-semibold">{summary.occupied}</div>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">Unregistered</div>
          <div className="mt-2 text-3xl font-semibold text-red-600">
            {summary.unregistered}
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">Violations</div>
          <div className="mt-2 text-3xl font-semibold text-orange-600">
            {summary.violations}
          </div>
        </div>
      </section>

      <section className="grid gap-3 rounded-3xl border bg-white p-4 md:grid-cols-5">
        <select
          className="rounded-2xl border px-4 py-3 text-sm outline-none"
          value={region}
          onChange={(event) => {
            setRegion(event.target.value);
            setDistrict('');
            setParkingLotId('');
            setSectionId('');
          }}
        >
          <option value="">All Regions</option>
          {regions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          className="rounded-2xl border px-4 py-3 text-sm outline-none"
          value={district}
          onChange={(event) => {
            setDistrict(event.target.value);
            setParkingLotId('');
            setSectionId('');
          }}
        >
          <option value="">All Districts</option>
          {districts.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          className="rounded-2xl border px-4 py-3 text-sm outline-none"
          value={parkingLotId}
          onChange={(event) => {
            setParkingLotId(event.target.value);
            setSectionId('');
          }}
        >
          <option value="">전체 주차장</option>
          {lots.map((lot) => (
            <option key={lot.id} value={lot.id}>
              {lot.name}
            </option>
          ))}
        </select>

        <select
          className="rounded-2xl border px-4 py-3 text-sm outline-none"
          value={sectionId}
          onChange={(event) => setSectionId(event.target.value)}
        >
          <option value="">전체 구역</option>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </select>

        <input
          className="rounded-2xl border px-4 py-3 text-sm outline-none"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="주차면, 상태 검색"
        />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">
        {filteredSpaces.map((space) => (
          <button
            key={space.id}
            type="button"
            className={[
              'rounded-2xl border p-3 text-left text-xs shadow-sm transition hover:shadow',
              statusClass(space),
            ].join(' ')}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{space.code}</span>
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px]">
                {statusLabel(space)}
              </span>
            </div>

            <div className="mt-2 space-y-0.5 text-[11px] text-slate-500">
              <div>{getSpaceLotName(space, data.parkingLots)}</div>
              <div>{getSpaceSectionName(space)}</div>
            </div>
          </button>
        ))}

        {!loading && filteredSpaces.length === 0 ? (
          <div className="col-span-full rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">
            No spaces found.
          </div>
        ) : null}
      </section>
    </main>
  );
}
