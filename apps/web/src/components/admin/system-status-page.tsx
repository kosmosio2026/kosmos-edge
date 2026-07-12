import { PageHeader } from '@/components/console/page-header';

function statusBadge(status: string) {
  const base = 'inline-flex rounded-full px-2 py-1 text-xs font-medium';
  if (status === 'UP') return `${base} bg-green-50 text-green-700`;
  if (status === 'WARN') return `${base} bg-amber-50 text-amber-700`;
  return `${base} bg-red-50 text-red-700`;
}

export function SystemStatusPage({
  services,
  certificates,
  dependencies,
  displayHeartbeats,
}: {
  services: any[];
  certificates: any[];
  dependencies: any[];
  displayHeartbeats: any[];
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="System Status"
        description="백엔드 / 워커 / 클라우드 / 전광판 / 인증서 / 의존성 상태"
      />

      <div className="grid gap-4 md:grid-cols-3">
        {services.map((item) => (
          <div key={item.service} className="rounded-3xl border bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-base font-semibold">{item.service}</div>
              <span className={statusBadge(item.status)}>{item.status}</span>
            </div>
            <div className="mt-3 text-sm text-slate-600">{item.detail ?? '-'}</div>
            <div className="mt-4 text-xs text-slate-400">
              Updated: {item.updatedAt ?? '-'}
            </div>
            {typeof item.responseTimeMs === 'number' ? (
              <div className="mt-1 text-xs text-slate-400">
                Response: {item.responseTimeMs} ms
              </div>
            ) : null}
            {typeof item.uptimeSec === 'number' ? (
              <div className="mt-1 text-xs text-slate-400">
                Uptime: {item.uptimeSec}s
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border bg-white p-5">
          <div className="mb-4 text-lg font-semibold">Dependencies</div>
          <div className="space-y-3">
            {dependencies.map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-2xl border px-4 py-3">
                <div>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-slate-500">{item.detail}</div>
                </div>
                <span className={statusBadge(item.status)}>{item.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <div className="mb-4 text-lg font-semibold">Display Heartbeats</div>
          <div className="space-y-3">
            {displayHeartbeats.map((item) => (
              <div key={item.deviceId} className="rounded-2xl border px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium">{item.deviceId}</div>
                  <span className={statusBadge(item.status)}>{item.status}</span>
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {item.lotName ?? '-'} · {item.sectionName ?? '-'}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  Last: {item.lastHeartbeatAt ? new Date(item.lastHeartbeatAt).toLocaleString() : '-'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border bg-white p-5">
        <div className="mb-4 text-lg font-semibold">Certificates</div>
        <div className="space-y-3">
          {certificates.map((item) => (
            <div key={item.name} className="flex items-center justify-between rounded-2xl border px-4 py-3">
              <div>
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-slate-500">{item.host}</div>
                <div className="text-xs text-slate-400">
                  Valid To: {item.validTo ? new Date(item.validTo).toLocaleString() : '-'}
                </div>
              </div>
              <div className="text-right">
                <span className={statusBadge(item.status)}>{item.status}</span>
                <div className="mt-1 text-xs text-slate-500">
                  {item.daysRemaining ?? '-'} days
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}