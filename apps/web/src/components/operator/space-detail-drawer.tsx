'use client';

import type { ParkingSpaceMapItem } from '@/types/operator';

export function SpaceDetailDrawer({
  open,
  space,
  loading,
  onClose,
  onRegister,
}: {
  open: boolean;
  space: ParkingSpaceMapItem | null;
  loading: boolean;
  onClose: () => void;
  onRegister: () => void;
}) {
  if (!open || !space) return null;

  const canRegister =
    space.occupancyState === 'OCCUPIED_UNREGISTERED' ||
    space.occupancyState === 'VIOLATION';

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <div className="text-lg font-semibold">{space.code}</div>
          <div className="text-sm text-slate-500">
            {space.lotName} · {space.sectionName}
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
        >
          Close
        </button>
      </div>

      <div className="space-y-5 px-6 py-6">
        <div>
          <div className="text-xs font-semibold uppercase text-slate-400">Status</div>
          <div className="mt-1 text-base font-medium">{space.occupancyState}</div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase text-slate-400">
            Geometry
          </div>
          <div className="mt-1 text-sm text-slate-700">
            {space.widthMeter}m × {space.heightMeter}m / {space.rotationDeg}°
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          {canRegister
            ? '이 주차면은 현재 주차 등록 가능 상태입니다.'
            : '이 주차면은 현재 등록 대상이 아닙니다.'}
        </div>

        <div className="flex gap-3">
          <button
            disabled={!canRegister || loading}
            onClick={onRegister}
            className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? 'Registering...' : '주차 등록'}
          </button>
        </div>
      </div>
    </div>
  );
}