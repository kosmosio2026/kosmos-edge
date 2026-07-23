'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';

import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';

type DeviceFaultItem = {
  id: string;
  faultId?: string | null;
  stored?: boolean;
  deviceId?: string | null;
  devEui?: string | null;
  name?: string | null;
  status?: string | null;
  title?: string | null;
  description?: string | null;
  reason?: string | null;
  code?: string | null;
  severity?: string | null;
  actionTaken?: string | null;
  actionResult?: string | null;
  detectedAt?: string | null;
  createdAt?: string | null;
  device?: {
    id?: string | null;
    name?: string | null;
    devEui?: string | null;
    type?: string | null;
    status?: string | null;
    serialNumber?: string | null;
  } | null;
  parkingSpace?: {
    id?: string | null;
    code?: string | null;
    section?: {
      name?: string | null;
      parkingLot?: {
        name?: string | null;
        code?: string | null;
      } | null;
    } | null;
  } | null;
  latestTelemetry?: {
    time?: string | null;
    lastMessageTime?: string | null;
    parkingStatus?: number | string | null;
    deviceStatus?: number | string | null;
    batteryStatus?: number | string | null;
    batteryVoltage?: number | null;
    rssi?: number | null;
    snr?: number | null;
    channel?: number | null;
    fCnt?: number | null;
  } | null;
};

function unwrapList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (value && typeof value === 'object') {
    const obj = value as { items?: unknown; data?: unknown; rows?: unknown };

    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.rows)) return obj.rows as T[];

    if (
      obj.data &&
      typeof obj.data === 'object' &&
      Array.isArray((obj.data as { items?: unknown }).items)
    ) {
      return (obj.data as { items: T[] }).items;
    }
  }

  return [];
}

function code(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return null;
  return String(value).trim().toUpperCase();
}

function formatParkingStatus(value?: number | string | null) {
  const c = code(value);
  if (!c) return '-';

  const labels: Record<string, string> = {
    '0': '출차',
    '1': '입차',
    '2': '출차 장애물',
    '3': '입차 장애물',
    '255': 'UNKNOWN',
    F: 'UNKNOWN',
    FF: 'UNKNOWN',
  };

  return labels[c] ?? c;
}

function formatDeviceStatus(value?: number | string | null) {
  const c = code(value);
  if (!c) return '-';
  if (c === '0') return '기기정상';
  if (c === '1') return '침수이상';
  if (['2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E'].includes(c)) {
    return 'Reserved';
  }
  if (c === 'F' || c === 'FF' || c === '255') return 'UNKNOWN';
  return c;
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSeverity(value?: string | null) {
  const c = String(value ?? '').toUpperCase();

  const labels: Record<string, string> = {
    CRITICAL: '긴급',
    HIGH: '높음',
    MEDIUM: '보통',
    LOW: '낮음',
  };

  return labels[c] ?? value ?? '-';
}

function severityClass(value?: string | null) {
  const c = String(value ?? '').toUpperCase();

  if (c === 'CRITICAL') return 'border-red-200 bg-red-50 text-red-700';
  if (c === 'HIGH') return 'border-orange-200 bg-orange-50 text-orange-700';
  if (c === 'MEDIUM') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function formatStatus(value?: string | null) {
  const c = String(value ?? '').toUpperCase();

  const labels: Record<string, string> = {
    OPEN: '미조치',
    IN_PROGRESS: '조치중',
    RESOLVED: '해결',
    CLOSED: '종결',
  };

  return labels[c] ?? value ?? '-';
}

function statusClass(value?: string | null) {
  const c = String(value ?? '').toUpperCase();

  if (c === 'OPEN') return 'border-red-200 bg-red-50 text-red-700';
  if (c === 'IN_PROGRESS') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (c === 'RESOLVED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function getDeviceName(item: DeviceFaultItem) {
  return item.device?.name ?? item.name ?? '장치';
}

function getDeviceId(item: DeviceFaultItem) {
  return item.deviceId ?? item.device?.id ?? null;
}

function getDevEui(item: DeviceFaultItem) {
  return item.device?.devEui ?? item.devEui ?? '-';
}

function getLotName(item: DeviceFaultItem) {
  return item.parkingSpace?.section?.parkingLot?.name ?? '-';
}

function getSectionName(item: DeviceFaultItem) {
  return item.parkingSpace?.section?.name ?? '-';
}

function getSpaceCode(item: DeviceFaultItem) {
  return item.parkingSpace?.code ?? '-';
}

function getBatteryText(item: DeviceFaultItem) {
  const voltage = item.latestTelemetry?.batteryVoltage;
  const status = item.latestTelemetry?.batteryStatus;

  const parts: string[] = [];

  if (voltage !== null && voltage !== undefined) {
    parts.push(`${Number(voltage).toFixed(2)}V`);
  }

  if (status !== null && status !== undefined) {
    parts.push(`상태 ${status}`);
  }

  return parts.length ? parts.join(' / ') : '-';
}

function getPayload(item: DeviceFaultItem) {
  return {
    sensorDeviceId: getDeviceId(item),
    devEui: getDevEui(item),
    name: getDeviceName(item),
    parkingSpaceId: item.parkingSpace?.id ?? null,
    title: item.title ?? item.code ?? '장치 장애',
    description: item.description ?? item.reason ?? null,
    reason: item.reason ?? item.description ?? null,
    code: item.code,
    severity: item.severity,
    latestTelemetry: item.latestTelemetry ?? null,
    parkingSpace: item.parkingSpace ?? null,
  };
}

export function OperatorDeviceFaultsPage() {
  const { session } = useAuth();

  const [items, setItems] = useState<DeviceFaultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<DeviceFaultItem | null>(null);
  const [actionTarget, setActionTarget] = useState<DeviceFaultItem | null>(null);
  const [closeTarget, setCloseTarget] = useState<DeviceFaultItem | null>(null);
  const [actionText, setActionText] = useState('');
  const [closeText, setCloseText] = useState('');

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setMessage(null);

    try {
      const result = await apiFetch('/devices/faults', {
        accessToken: session.accessToken,
      });

      setItems(unwrapList<DeviceFaultItem>(result));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '장애 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    return {
      total: items.length,
      urgent: items.filter((item) =>
        ['CRITICAL', 'HIGH'].includes(String(item.severity ?? '').toUpperCase()),
      ).length,
      open: items.filter((item) => String(item.status ?? '').toUpperCase() === 'OPEN').length,
      inProgress: items.filter((item) =>
        String(item.status ?? '').toUpperCase().includes('IN_PROGRESS'),
      ).length,
    };
  }, [items]);

  async function submitAction(event: FormEvent) {
    event.preventDefault();

    if (!session?.accessToken || !actionTarget) return;

    const text = actionText.trim();

    if (!text) {
      setMessage('조치 내용을 입력해 주세요.');
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await apiFetch(`/devices/faults/${encodeURIComponent(actionTarget.id)}/action`, {
        method: 'POST',
        accessToken: session.accessToken,
        body: JSON.stringify({
          ...getPayload(actionTarget),
          actionTaken: text,
        }),
      });

      setActionTarget(null);
      setActionText('');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '조치 내용을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function submitClose(event: FormEvent) {
    event.preventDefault();

    if (!session?.accessToken || !closeTarget) return;

    const text = closeText.trim();

    if (!text) {
      setMessage('종결 사유를 입력해 주세요.');
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await apiFetch(`/devices/faults/${encodeURIComponent(closeTarget.id)}/close`, {
        method: 'POST',
        accessToken: session.accessToken,
        body: JSON.stringify({
          ...getPayload(closeTarget),
          actionResult: text,
        }),
      });

      setCloseTarget(null);
      setCloseText('');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '장애를 종결하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-6 md:px-8">
      <section className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-300">Operator Tablet</p>
              <h1 className="mt-1 text-3xl font-black">장애 관리</h1>
              <p className="mt-2 text-sm text-slate-300">
                담당 구역의 센서 장애를 확인하고 현장 조치 및 종결을 등록합니다.
              </p>
            </div>

            <div className="flex gap-2">
              <Link
                href="/operator/parking/history"
                className="rounded-2xl bg-white/10 px-5 py-3 text-sm font-bold text-white hover:bg-white/20"
              >
                주차 이력
              </Link>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-950"
              >
                새로고침
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <div className="rounded-3xl bg-white/10 p-4">
              <p className="text-sm text-slate-300">전체 장애</p>
              <p className="mt-2 text-3xl font-black">{summary.total}</p>
            </div>
            <div className="rounded-3xl bg-white/10 p-4">
              <p className="text-sm text-slate-300">긴급/높음</p>
              <p className="mt-2 text-3xl font-black text-red-300">{summary.urgent}</p>
            </div>
            <div className="rounded-3xl bg-white/10 p-4">
              <p className="text-sm text-slate-300">미조치</p>
              <p className="mt-2 text-3xl font-black text-orange-300">{summary.open}</p>
            </div>
            <div className="rounded-3xl bg-white/10 p-4">
              <p className="text-sm text-slate-300">조치중</p>
              <p className="mt-2 text-3xl font-black text-blue-300">{summary.inProgress}</p>
            </div>
          </div>
        </div>

        {message ? (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
            {message}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-[2rem] bg-white p-8 text-center text-slate-500 shadow-sm">
            장애 목록을 불러오는 중입니다.
          </div>
        ) : null}

        {!loading && items.length === 0 ? (
          <div className="rounded-[2rem] bg-white p-10 text-center shadow-sm">
            <p className="text-2xl font-black text-slate-900">현재 장애가 없습니다.</p>
            <p className="mt-2 text-sm text-slate-500">
              새 장애가 발생하면 이 화면에 자동으로 표시됩니다.
            </p>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-2">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-black ${severityClass(
                        item.severity,
                      )}`}
                    >
                      {formatSeverity(item.severity)}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(
                        item.status,
                      )}`}
                    >
                      {formatStatus(item.status)}
                    </span>
                  </div>

                  <h2 className="mt-3 text-2xl font-black text-slate-950">
                    {item.title ?? item.code ?? '장치 장애'}
                  </h2>

                  <p className="mt-1 font-mono text-sm text-slate-500">{getDevEui(item)}</p>
                </div>

                <div className="rounded-2xl bg-slate-100 px-4 py-3 text-right">
                  <p className="text-xs font-bold text-slate-500">최근 수신</p>
                  <p className="mt-1 text-sm font-black text-slate-900">
                    {formatDateTime(
                      item.latestTelemetry?.lastMessageTime ??
                        item.latestTelemetry?.time ??
                        item.detectedAt,
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-500">위치</p>
                  <p className="mt-1 font-black text-slate-900">{getLotName(item)}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {getSectionName(item)} / {getSpaceCode(item)}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-500">상태</p>
                  <p className="mt-1 font-black text-slate-900">
                    {formatParkingStatus(item.latestTelemetry?.parkingStatus)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatDeviceStatus(item.latestTelemetry?.deviceStatus)}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-500">신호/배터리</p>
                  <p className="mt-1 font-black text-slate-900">
                    RSSI {item.latestTelemetry?.rssi ?? '-'} / SNR {item.latestTelemetry?.snr ?? '-'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{getBatteryText(item)}</p>
                </div>
              </div>

              {item.actionTaken ? (
                <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
                  <p className="font-black">최근 조치</p>
                  <p className="mt-1">{item.actionTaken}</p>
                </div>
              ) : null}

              <div className="mt-5 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDetailItem(item)}
                  className="rounded-2xl border border-slate-200 px-4 py-4 text-base font-black text-slate-700"
                >
                  상세
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActionTarget(item);
                    setActionText(item.actionTaken ?? '');
                  }}
                  className="rounded-2xl bg-blue-600 px-4 py-4 text-base font-black text-white"
                >
                  조치
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCloseTarget(item);
                    setCloseText(item.actionResult ?? '');
                  }}
                  className="rounded-2xl bg-slate-950 px-4 py-4 text-base font-black text-white"
                >
                  종결
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {detailItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-[2rem] bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-slate-500">장애 상세</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  {detailItem.title ?? detailItem.code}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="rounded-2xl border px-5 py-3 font-bold"
              >
                닫기
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="font-black text-slate-900">장애 사유</p>
                <p className="mt-2 text-slate-700">
                  {detailItem.reason ?? detailItem.description ?? '-'}
                </p>
              </div>

              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="font-black text-slate-900">조치 내용</p>
                <p className="mt-2 text-slate-700">{detailItem.actionTaken ?? '-'}</p>
              </div>

              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="font-black text-slate-900">조치 결과 / 종결 사유</p>
                <p className="mt-2 text-slate-700">{detailItem.actionResult ?? '-'}</p>
              </div>

              <pre className="max-h-72 overflow-auto rounded-3xl bg-slate-950 p-4 text-xs text-slate-100">
                {JSON.stringify(detailItem.latestTelemetry ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      ) : null}

      {actionTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5">
          <form
            onSubmit={submitAction}
            className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-xl"
          >
            <h2 className="text-2xl font-black text-slate-950">조치 등록</h2>
            <p className="mt-1 text-sm text-slate-500">
              {actionTarget.title ?? actionTarget.code} / {getDevEui(actionTarget)}
            </p>

            <textarea
              value={actionText}
              onChange={(event) => setActionText(event.target.value)}
              className="mt-5 h-44 w-full rounded-3xl border p-4 text-base outline-none focus:border-blue-500"
              placeholder="예: 현장 확인 후 센서 주변 이물질 제거, 배터리 상태 확인"
            />

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setActionTarget(null);
                  setActionText('');
                }}
                className="rounded-2xl border px-5 py-4 font-black"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-blue-600 px-5 py-4 font-black text-white disabled:opacity-50"
              >
                저장
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {closeTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5">
          <form
            onSubmit={submitClose}
            className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-xl"
          >
            <h2 className="text-2xl font-black text-slate-950">장애 종결</h2>
            <p className="mt-1 text-sm text-slate-500">
              종결하면 같은 장치의 같은 장애 유형은 목록에서 사라집니다.
            </p>

            <textarea
              value={closeText}
              onChange={(event) => setCloseText(event.target.value)}
              className="mt-5 h-44 w-full rounded-3xl border p-4 text-base outline-none focus:border-blue-500"
              placeholder="예: 조치 완료 후 정상 동작 확인"
            />

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setCloseTarget(null);
                  setCloseText('');
                }}
                className="rounded-2xl border px-5 py-4 font-black"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-slate-950 px-5 py-4 font-black text-white disabled:opacity-50"
              >
                종결
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
