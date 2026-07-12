'use client';

import type { OperatorEventLogItem } from '@/types/operator';

export function EventLogPanel({
  items,
}: {
  items: OperatorEventLogItem[];
}) {
  return (
    <div className="rounded-3xl border bg-white p-5">
      <div className="mb-4 text-lg font-semibold">Event Log</div>
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="text-sm text-slate-500">이벤트가 없습니다.</div>
        ) : null}

        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border px-4 py-3"
          >
            <div className="flex items-center justify-between gap-4">
              <div
                className={`text-xs font-semibold uppercase ${
                  item.level === 'danger'
                    ? 'text-red-600'
                    : item.level === 'warn'
                      ? 'text-amber-600'
                      : 'text-blue-600'
                }`}
              >
                {item.level}
              </div>
              <div className="text-xs text-slate-400">{item.createdAt}</div>
            </div>
            <div className="mt-2 text-sm text-slate-700">{item.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}