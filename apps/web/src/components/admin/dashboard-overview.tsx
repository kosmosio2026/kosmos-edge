import {
  getDashboardStatItems,
  type DashboardStatCard,
  type SystemStatusItem,
} from '@/lib/dashboard-stats';

export async function DashboardOverview() {
  const result = await getDashboardStatItems();

  const stats: DashboardStatCard[] = Array.isArray(result)
    ? result
    : result.stats ?? [];

  const statuses: SystemStatusItem[] = Array.isArray(result)
    ? []
    : result.statuses ?? [];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border bg-white p-5 shadow-sm"
          >
            <div className="text-sm text-slate-500">{item.label}</div>
            <div className="mt-2 text-2xl font-bold">{item.value}</div>
            {item.description ? (
              <div className="mt-1 text-xs text-slate-400">
                {item.description}
              </div>
            ) : null}
          </div>
        ))}
      </section>

      {statuses.length > 0 ? (
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">System Status</h2>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {statuses.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border bg-slate-50 p-4"
              >
                <div className="text-sm text-slate-500">{item.label}</div>
                <div className="mt-1 font-semibold">{item.status}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}