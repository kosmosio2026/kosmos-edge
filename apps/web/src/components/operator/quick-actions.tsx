'use client';

import type { OperatorQuickAction, ParkingSpaceMapItem } from '@/types/operator';

const actions: Array<{ key: OperatorQuickAction; label: string }> = [
  { key: 'register', label: '주차 등록' },
  { key: 'entry', label: '입차 처리' },
  { key: 'exit', label: '출차 처리' },
  { key: 'collect', label: '수금 처리' },
  { key: 'fault', label: '장애 접수' },
];

export function QuickActions({
  selectedSpace,
  onAction,
}: {
  selectedSpace: ParkingSpaceMapItem | null;
  onAction: (action: OperatorQuickAction) => void;
}) {
  return (
    <div className="rounded-3xl border bg-white p-5">
      <div className="mb-4 text-lg font-semibold">Quick Actions</div>
      <div className="grid gap-3 md:grid-cols-5">
        {actions.map((action) => (
          <button
            key={action.key}
            disabled={!selectedSpace}
            onClick={() => onAction(action.key)}
            className="rounded-2xl border px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            {action.label}
          </button>
        ))}
      </div>
      {!selectedSpace ? (
        <div className="mt-3 text-sm text-slate-500">
          먼저 주차면을 선택하세요.
        </div>
      ) : null}
    </div>
  );
}