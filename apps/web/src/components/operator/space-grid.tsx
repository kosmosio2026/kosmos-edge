'use client';

import type { ParkingSpaceMapItem } from '@/types/operator';

function badgeClass(state: string) {
  switch (state) {
    case 'EMPTY':
      return 'bg-green-50 text-green-700';
    case 'OCCUPIED_REGISTERED':
      return 'bg-red-50 text-red-700';
    case 'OCCUPIED_UNREGISTERED':
      return 'bg-amber-50 text-amber-700';
    case 'VIOLATION':
      return 'bg-violet-50 text-violet-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export function SpaceGrid({
  spaces,
  onSelect,
}: {
  spaces: ParkingSpaceMapItem[];
  onSelect: (space: ParkingSpaceMapItem) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {spaces.map((space) => (
        <button
          key={space.id}
          onClick={() => onSelect(space)}
          className="rounded-3xl border bg-white p-4 text-left hover:bg-slate-50"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="text-base font-semibold">{space.code}</div>
            <div className={`rounded-full px-2 py-1 text-xs font-medium ${badgeClass(space.occupancyState)}`}>
              {space.occupancyState}
            </div>
          </div>
          <div className="mt-2 text-sm text-slate-500">
            {space.lotName} · {space.sectionName}
          </div>
          <div className="mt-3 text-xs text-slate-400">
            {space.widthMeter}m × {space.heightMeter}m / {space.rotationDeg}°
          </div>
        </button>
      ))}
    </div>
  );
}