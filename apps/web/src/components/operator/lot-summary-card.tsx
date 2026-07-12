'use client';

import type { ParkingLotMapItem } from '@/types/operator';

export function LotSummaryCard({
  lot,
}: {
  lot: ParkingLotMapItem | null;
}) {
  if (!lot) {
    return (
      <div className="rounded-3xl border bg-white p-5">
        <div className="text-sm text-slate-500">주차장을 선택하세요.</div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border bg-white p-5">
      <div className="text-lg font-semibold">{lot.name}</div>
      <div className="mt-1 text-sm text-slate-500">{lot.code}</div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="text-slate-500">운영 상태</div>
          <div className="mt-1 font-semibold">{lot.operation.status}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="text-slate-500">장애 수</div>
          <div className="mt-1 font-semibold">{lot.operation.openFaultCount}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="text-slate-500">전체 주차면</div>
          <div className="mt-1 font-semibold">{lot.summary.totalSpaces}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="text-slate-500">여유 주차면</div>
          <div className="mt-1 font-semibold">{lot.summary.availableSpaces}</div>
        </div>
      </div>
    </div>
  );
}