import type { DashboardStatCard } from '@/types/admin';

export function StatCards({ items }: { items: DashboardStatCard[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">{item.label}</div>
          <div className="mt-2 text-2xl font-semibold">{item.value}</div>
          {item.description ? (
            <div className="mt-2 text-xs text-slate-400">{item.description}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}