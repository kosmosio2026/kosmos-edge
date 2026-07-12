'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';
import type { ConsoleRole } from '@/lib/console-role';

type Props = {
  role?: ConsoleRole;
};

type ServiceStatus = {
  id?: string;
  key: string;
  label?: string;
  name?: string;
  description?: string | null;
  host?: string | null;
  port?: number | null;
  commandType?: 'systemctl' | 'pm2';
  targetName?: string;
  enabled?: boolean;
  sortOrder?: number;
  status: 'online' | 'offline' | 'unknown' | 'disabled';
  raw?: string;
  checkedAt?: string;
};

type ControlPanelStatus = {
  ok?: boolean;
  checkedAt?: string;
  services?: ServiceStatus[];
  hardware?: {
    displays?: unknown[];
    message?: string;
  };
  health?: Record<string, unknown>;
};

type ServiceForm = {
  id?: string;
  key: string;
  name: string;
  description: string;
  host: string;
  port: string;
  commandType: 'systemctl' | 'pm2';
  targetName: string;
  enabled: boolean;
  sortOrder: string;
};

const emptyForm: ServiceForm = {
  key: '',
  name: '',
  description: '',
  host: 'localhost',
  port: '',
  commandType: 'systemctl',
  targetName: '',
  enabled: true,
  sortOrder: '100',
};

function statusClass(status: string) {
  if (status === 'online') return 'bg-emerald-50 text-emerald-700';
  if (status === 'offline') return 'bg-red-50 text-red-700';
  if (status === 'disabled') return 'bg-slate-100 text-slate-400';
  return 'bg-amber-50 text-amber-700';
}

function statusLabel(status: string) {
  if (status === 'online') return '온라인';
  if (status === 'offline') return '오프라인';
  if (status === 'disabled') return '비활성';
  return '확인 필요';
}

function ServiceStatusBadge({ status }: { status: ServiceStatus['status'] }) {
  return (
    <span
      className={[
        'inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-bold',
        statusClass(status),
      ].join(' ')}
    >
      {status === 'online' ? (
        <span className="mr-1.5 inline-block h-3 w-3 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      ) : null}

      {status === 'offline' ? (
        <span className="mr-1.5 inline-block h-3 w-3 rounded-full bg-red-500" />
      ) : null}

      {status === 'unknown' ? (
        <span className="mr-1.5 inline-block h-3 w-3 animate-pulse rounded-full bg-amber-500" />
      ) : null}

      {status === 'disabled' ? (
        <span className="mr-1.5 inline-block h-3 w-3 rounded-full bg-slate-300" />
      ) : null}

      {statusLabel(status)}
    </span>
  );
}

function actionLabel(action: 'start' | 'stop' | 'restart') {
  if (action === 'start') return '시작';
  if (action === 'stop') return '중지';
  return '재시작';
}

function formatDate(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString();
}

function commandPreview(form: ServiceForm) {
  if (!form.targetName.trim()) return '-';

  if (form.commandType === 'pm2') {
    return `pm2 start|stop|restart ${form.targetName.trim()}`;
  }

  return `sudo systemctl start|stop|restart ${form.targetName.trim()}`;
}

function getAllowedServiceActions(
  service: ServiceStatus,
): Array<'start' | 'stop' | 'restart'> {
  const targetName = service.targetName ?? '';
  const key = service.key ?? '';

  if (key === 'api' || targetName === 'kosmos-cloud-api') {
    return ['restart'];
  }

  if (key === 'web' || targetName === 'kosmos-edge-web') {
    return ['restart'];
  }

  if (service.status === 'disabled') {
    return [];
  }

  return ['start', 'stop', 'restart'];
}

export default function ControlPanelPage({ role = 'admin' }: Props) {
  const { session } = useAuth();

  const [status, setStatus] = useState<ControlPanelStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [actingKey, setActingKey] = useState<string | null>(null);
  const [displayMessage, setDisplayMessage] = useState('');
  const [displayId, setDisplayId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [savingService, setSavingService] = useState(false);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logTitle, setLogTitle] = useState('');
  const [logText, setLogText] = useState('');
  const [logLoading, setLogLoading] = useState(false);

  const canManage = role === 'admin' || role === 'manager';

  const services = useMemo(
    () =>
      [...(status?.services ?? [])].sort(
        (a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100),
      ),
    [status?.services],
  );

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const result = await apiFetch('/control-panel/status', {
        accessToken: session.accessToken,
      });

      setStatus(result as ControlPanelStatus);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : '제어판 상태를 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreateModal() {
    setForm(emptyForm);
    setModalOpen(true);
    setError(null);
    setNotice(null);
  }

  function openEditModal(service: ServiceStatus) {
    setForm({
      id: service.id,
      key: service.key ?? '',
      name: service.name ?? service.label ?? '',
      description: service.description ?? '',
      host: service.host ?? '',
      port: service.port === null || service.port === undefined ? '' : String(service.port),
      commandType: service.commandType ?? 'systemctl',
      targetName: service.targetName ?? '',
      enabled: service.enabled ?? true,
      sortOrder: String(service.sortOrder ?? 100),
    });
    setModalOpen(true);
    setError(null);
    setNotice(null);
  }

  async function saveService(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.accessToken || !canManage) return;

    setSavingService(true);
    setError(null);
    setNotice(null);

    const payload = {
      key: form.key.trim() || undefined,
      name: form.name.trim(),
      description: form.description.trim() || null,
      host: form.host.trim() || null,
      port: form.port.trim() ? Number(form.port) : null,
      commandType: form.commandType,
      targetName: form.targetName.trim(),
      enabled: form.enabled,
      sortOrder: form.sortOrder.trim() ? Number(form.sortOrder) : 100,
    };

    try {
      await apiFetch(
        form.id
          ? `/control-panel/services/${encodeURIComponent(form.id)}`
          : '/control-panel/services',
        {
          method: form.id ? 'PATCH' : 'POST',
          accessToken: session.accessToken,
          body: JSON.stringify(payload),
        },
      );

      setModalOpen(false);
      setNotice(form.id ? '서비스 설정을 수정했습니다.' : '서비스를 추가했습니다.');
      await load();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : '서비스 설정 저장에 실패했습니다.',
      );
    } finally {
      setSavingService(false);
    }
  }

  async function deleteService(service: ServiceStatus) {
    if (!session?.accessToken || !canManage || !service.id) return;

    const ok = window.confirm(
      `${service.name ?? service.label ?? service.key} 서비스를 삭제할까요?`,
    );

    if (!ok) return;

    setError(null);
    setNotice(null);

    try {
      await apiFetch(
        `/control-panel/services/${encodeURIComponent(service.id)}`,
        {
          method: 'DELETE',
          accessToken: session.accessToken,
        },
      );

      setNotice('서비스를 삭제했습니다.');
      await load();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : '서비스 삭제에 실패했습니다.',
      );
    }
  }

  async function serviceAction(
    service: ServiceStatus,
    action: 'start' | 'stop' | 'restart',
  ) {
    if (!session?.accessToken || !canManage) return;

    const serviceId = service.id ?? service.key;

    setActingKey(`${serviceId}:${action}`);
    setError(null);
    setNotice(null);

    try {
      const result = await apiFetch(
        `/control-panel/services/${encodeURIComponent(serviceId)}/action`,
        {
          method: 'POST',
          accessToken: session.accessToken,
          body: JSON.stringify({ action }),
        },
      );

      const message =
        typeof result === 'object' && result && 'message' in result
          ? String((result as { message?: unknown }).message ?? '')
          : '';

      setNotice(
        message ||
          `${service.name ?? service.key} ${actionLabel(action)} 요청을 보냈습니다. 잠시 후 상태를 다시 확인합니다.`,
      );

      if (action === 'restart') {
        window.setTimeout(() => {
          void load();
        }, 4000);
      } else {
        await load();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : '서비스 제어에 실패했습니다.';

      if (action === 'restart' && /failed to fetch|network|fetch/i.test(message)) {
        setNotice(
          `${service.name ?? service.key} 재시작 요청을 보냈습니다. 서비스가 다시 올라오는 중입니다. 잠시 후 상태를 새로고침합니다.`,
        );

        window.setTimeout(() => {
          void load();
        }, 5000);
      } else {
        setError(message);
      }
    } finally {
      setActingKey(null);
    }
  }

  async function openServiceLogs(service: ServiceStatus) {
    if (!session?.accessToken) return;

    const serviceId = service.id ?? service.key;

    setLogModalOpen(true);
    setLogTitle(`${service.name ?? service.label ?? service.key} 로그`);
    setLogText('');
    setLogLoading(true);
    setError(null);

    try {
      const result = await apiFetch(
        `/control-panel/services/${encodeURIComponent(serviceId)}/logs?lines=160`,
        {
          accessToken: session.accessToken,
        },
      );

      const obj = result as {
        ok?: boolean;
        message?: string;
        logs?: string;
      };

      if (obj.ok === false) {
        setLogText(obj.message || '서비스 로그를 불러오지 못했습니다.');
      } else {
        setLogText(obj.logs || '표시할 로그가 없습니다.');
      }
    } catch (error) {
      setLogText(
        error instanceof Error
          ? error.message
          : '서비스 로그를 불러오지 못했습니다.',
      );
    } finally {
      setLogLoading(false);
    }
  }

  async function sendDisplayMessage() {
    if (!session?.accessToken || !canManage) return;

    setError(null);
    setNotice(null);

    try {
      await apiFetch('/control-panel/hardware/display/message', {
        method: 'POST',
        accessToken: session.accessToken,
        body: JSON.stringify({
          displayId: displayId.trim() || undefined,
          message: displayMessage.trim(),
        }),
      });

      setNotice('전광판 메시지 전송 요청을 보냈습니다.');
      setDisplayMessage('');
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : '전광판 메시지 전송에 실패했습니다.',
      );
    }
  }

  async function displayPower(power: 'on' | 'off' | 'reboot') {
    if (!session?.accessToken || !canManage) return;

    setError(null);
    setNotice(null);

    try {
      await apiFetch('/control-panel/hardware/display/power', {
        method: 'POST',
        accessToken: session.accessToken,
        body: JSON.stringify({
          displayId: displayId.trim() || undefined,
          power,
        }),
      });

      setNotice(`전광판 전원 ${power} 요청을 보냈습니다.`);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : '전광판 전원 제어에 실패했습니다.',
      );
    }
  }

  return (
    <main className="w-full max-w-none space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">제어판</h1>
          <p className="mt-1 text-sm text-slate-500">
            API, Web, Daemon, ChirpStack, WebSocket 및 현장 하드웨어 상태를 확인하고 제어합니다.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <button
              type="button"
              onClick={openCreateModal}
              className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700"
            >
              서비스 추가
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => void load()}
            className="rounded-2xl border px-4 py-2 text-sm font-bold hover:bg-slate-50"
          >
            새로고침
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <section className="rounded-3xl border bg-white p-5">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-bold">서비스 상태</h2>
            <p className="text-sm text-slate-500">
              최근 확인: {formatDate(status?.checkedAt)}
            </p>
          </div>
          {loading ? (
            <span className="text-sm text-slate-500">불러오는 중...</span>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {services.map((service) => {
            const serviceId = service.id ?? service.key;

            return (
              <div key={serviceId} className="rounded-3xl border p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-950">
                      {service.name ?? service.label ?? service.key}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {service.key} · {service.commandType ?? 'systemctl'} · {service.targetName ?? '-'}
                    </div>
                    {service.host || service.port ? (
                      <div className="mt-1 text-xs text-slate-400">
                        {service.host ?? '-'}
                        {service.port ? `:${service.port}` : ''}
                      </div>
                    ) : null}
                  </div>

                  <ServiceStatusBadge status={service.status} />
                </div>

                {service.description ? (
                  <p className="mt-3 text-sm text-slate-500">
                    {service.description}
                  </p>
                ) : null}

                {service.raw ? (
                  <div className="mt-3 max-h-24 overflow-auto rounded-xl bg-slate-50 p-2 text-xs text-slate-500">
                    {service.raw}
                  </div>
                ) : null}

                {canManage ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {getAllowedServiceActions(service).map((action) => (
                      <button
                        key={action}
                        type="button"
                        disabled={
                          actingKey === `${serviceId}:${action}` ||
                          service.status === 'disabled'
                        }
                        onClick={() => void serviceAction(service, action)}
                        className="rounded-xl border px-3 py-1.5 text-xs font-bold hover:bg-slate-50 disabled:opacity-50"
                      >
                        {actionLabel(action)}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => void openServiceLogs(service)}
                      className="rounded-xl border px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      로그
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditModal(service)}
                      className="rounded-xl border px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50"
                    >
                      설정
                    </button>

                    {service.id ? (
                      <button
                        type="button"
                        onClick={() => void deleteService(service)}
                        className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}

          {services.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500 md:col-span-2 xl:col-span-3">
              등록된 서비스가 없습니다.
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border bg-white p-5">
          <h2 className="text-lg font-bold">전광판 하드웨어 제어</h2>
          <p className="mt-1 text-sm text-slate-500">
            전광판 전원 제어, 재부팅, 표출 메시지 전송을 준비합니다.
          </p>

          <div className="mt-4 space-y-3">
            <input
              className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
              value={displayId}
              onChange={(event) => setDisplayId(event.target.value)}
              placeholder="전광판 ID, 선택 사항"
            />
            <textarea
              className="min-h-28 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
              value={displayMessage}
              onChange={(event) => setDisplayMessage(event.target.value)}
              placeholder="표출할 메시지 또는 JSON payload"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!canManage || !displayMessage.trim()}
                onClick={() => void sendDisplayMessage()}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                메시지 전송
              </button>
              {(['on', 'off', 'reboot'] as const).map((power) => (
                <button
                  key={power}
                  type="button"
                  disabled={!canManage}
                  onClick={() => void displayPower(power)}
                  className="rounded-2xl border px-4 py-2 text-sm font-bold hover:bg-slate-50 disabled:opacity-50"
                >
                  전원 {power}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <h2 className="text-lg font-bold">Health Snapshot</h2>
          <p className="mt-1 text-sm text-slate-500">
            시스템 health, daemon heartbeat, websocket 연결 현황을 표시합니다.
          </p>

          <pre className="mt-4 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
            {JSON.stringify(
              {
                health: status?.health ?? {},
                hardware: status?.hardware ?? {},
              },
              null,
              2,
            )}
          </pre>
        </div>
      </section>

      {logModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">{logTitle}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  최근 서비스 로그를 확인합니다.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setLogModalOpen(false)}
                className="rounded-xl px-2 py-1 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <pre className="max-h-[70vh] overflow-auto bg-slate-950 p-5 text-xs leading-5 text-slate-100">
              {logLoading ? '불러오는 중...' : logText}
            </pre>
          </div>
        </div>
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  {form.id ? '서비스 설정' : '서비스 추가'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  systemctl 또는 pm2 기반으로 제어할 서비스를 등록합니다.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl px-2 py-1 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form className="grid gap-4 md:grid-cols-2" onSubmit={saveService}>
              <label className="block text-sm font-medium">
                서비스명
                <input
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                  placeholder="예: Cloud API"
                  required
                />
              </label>

              <label className="block text-sm font-medium">
                서비스 키
                <input
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  value={form.key}
                  onChange={(event) =>
                    setForm({ ...form, key: event.target.value })
                  }
                  placeholder="예: api"
                />
              </label>

              <label className="block text-sm font-medium">
                명령 타입
                <select
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  value={form.commandType}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      commandType: event.target.value as 'systemctl' | 'pm2',
                    })
                  }
                >
                  <option value="systemctl">systemctl</option>
                  <option value="pm2">pm2</option>
                </select>
              </label>

              <label className="block text-sm font-medium">
                실행 대상
                <input
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  value={form.targetName}
                  onChange={(event) =>
                    setForm({ ...form, targetName: event.target.value })
                  }
                  placeholder="예: kosmos-cloud-api"
                  required
                />
              </label>

              <label className="block text-sm font-medium">
                Host
                <input
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  value={form.host}
                  onChange={(event) =>
                    setForm({ ...form, host: event.target.value })
                  }
                  placeholder="localhost"
                />
              </label>

              <label className="block text-sm font-medium">
                Port
                <input
                  type="number"
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  value={form.port}
                  onChange={(event) =>
                    setForm({ ...form, port: event.target.value })
                  }
                  placeholder="3000"
                />
              </label>

              <label className="block text-sm font-medium">
                정렬 순서
                <input
                  type="number"
                  className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  value={form.sortOrder}
                  onChange={(event) =>
                    setForm({ ...form, sortOrder: event.target.value })
                  }
                />
              </label>

              <label className="flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(event) =>
                    setForm({ ...form, enabled: event.target.checked })
                  }
                />
                사용
              </label>

              <label className="block text-sm font-medium md:col-span-2">
                설명
                <textarea
                  className="mt-2 min-h-24 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                  placeholder="서비스 설명"
                />
              </label>

              <div className="rounded-2xl bg-slate-50 p-4 text-xs text-slate-600 md:col-span-2">
                <div className="font-bold text-slate-800">실행 명령 미리보기</div>
                <div className="mt-1 font-mono">{commandPreview(form)}</div>
                <div className="mt-2 text-slate-500">
                  자유 명령어는 저장하지 않고, API가 안전한 고정 명령만 조합합니다.
                </div>
              </div>

              <div className="flex justify-end gap-2 md:col-span-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-2xl border px-4 py-2 text-sm font-bold hover:bg-slate-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={savingService || !form.name.trim() || !form.targetName.trim()}
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {savingService ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
