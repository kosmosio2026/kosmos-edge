'use client';

import type {
  OperatorFilters,
  ParkingLotMapItem,
  ParkingSpaceMapItem,
} from '@/types/operator';

export function FilterBar({
  lots,
  spaces,
  filters,
  onChange,
}: {
  lots: ParkingLotMapItem[];
  spaces: ParkingSpaceMapItem[];
  filters: OperatorFilters;
  onChange: (next: OperatorFilters) => void;
}) {
  const sections = Array.from(
    new Map(
      spaces
        .filter((space) =>
          filters.parkingLotId ? space.lotId === filters.parkingLotId : true,
        )
        .map((space) => [space.sectionId, { id: space.sectionId, name: space.sectionName }]),
    ).values(),
  );

  return (
    <div className="grid gap-3 rounded-3xl border bg-white p-4 md:grid-cols-4">
      <select
        className="rounded-2xl border px-4 py-3 text-sm"
        value={filters.parkingLotId}
        onChange={(e) =>
          onChange({
            ...filters,
            parkingLotId: e.target.value,
            sectionId: '',
          })
        }
      >
        <option value="">전체 주차장</option>
        {lots.map((lot) => (
          <option key={lot.id} value={lot.id}>
            {lot.name}
          </option>
        ))}
      </select>

      <select
        className="rounded-2xl border px-4 py-3 text-sm"
        value={filters.sectionId}
        onChange={(e) =>
          onChange({
            ...filters,
            sectionId: e.target.value,
          })
        }
      >
        <option value="">전체 구역</option>
        {sections.map((section) => (
          <option key={section.id} value={section.id}>
            {section.name}
          </option>
        ))}
      </select>

      <input
        className="rounded-2xl border px-4 py-3 text-sm"
        placeholder="주차면 코드 검색"
        value={filters.search}
        onChange={(e) =>
          onChange({
            ...filters,
            search: e.target.value,
          })
        }
      />

      <div className="flex overflow-hidden rounded-2xl border">
        <button
          className={`flex-1 px-4 py-3 text-sm ${
            filters.viewMode === 'map' ? 'bg-slate-900 text-white' : 'bg-white'
          }`}
          onClick={() => onChange({ ...filters, viewMode: 'map' })}
        >
          Map
        </button>
        <button
          className={`flex-1 px-4 py-3 text-sm ${
            filters.viewMode === 'grid' ? 'bg-slate-900 text-white' : 'bg-white'
          }`}
          onClick={() => onChange({ ...filters, viewMode: 'grid' })}
        >
          Grid
        </button>
      </div>
    </div>
  );
}