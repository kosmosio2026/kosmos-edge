'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';

type Props = {
  role?: 'admin' | 'manager' | 'operator';
};

type DeviceFaultItem = {
  id: string;
  faultId?: string | null;
  stored?: boolean;
  deviceId?: string | null;
  devEui?: string | null;
  name?: string | null;
  grade?: string | null;
  reason?: string | null;
  status?: string | null;
  title?: string | null;
  description?: string | null;
  code?: string | null;
  severity?: string | null;
  detectedAt?: string | null;
  createdAt?: string | null;
  actionTaken?: string | null;
  actionResult?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
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
    firmwareVersion?: number | string | null;
    rssi?: number | null;
    snr?: number | null;
    channel?: number | null;
    fCnt?: number | null;
  } | null;
};

function unwrapList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (value && typeof value === 'object') {
    const obj = value as {
      items?: unknown;
      data?: unknown;
    };

    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];

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

function normalizeCode(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return null;
  return String(value).trim().toUpperCase();
}

function formatParkingStatus(value?: number | string | null) {
  const code = normalizeCode(value);
  if (!code) return '-';

  const labels: Record<string, string> = {
    '0': '출차',
    '1': '입차',
    '2': '출차 장애물',
    '3': '입차 장애물',
    '255': 'UNKNOWN',
    FF: 'UNKNOWN',
    F: 'UNKNOWN',
  };

  return labels[code] ?? code;
}

function formatDeviceStatus(value?: number | string | null) {
  const code = normalizeCode(value);
  if (!code) return '-';

  if (code === '0') return '기기정상';
  if (code === '1') return '침수이상';

  if (
    ['2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E'].includes(code)
  ) {
    return 'Reserved';
  }

  if (code === 'F' || code === 'FF' || code === '255') return 'UNKNOWN';

  return code;
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
  });
}

function formatDevEui(value?: string | null) {
  const compact = String(value ?? '').trim().replace(/[\s:-]/g, '').toUpperCase();

  return compact || '-';
}

function formatSeverity(value?: string | null) {
  const severity = String(value ?? '').toUpperCase();

  const labels: Record<string, string> = {
    CRITICAL: '긴급',
    HIGH: '높음',
    MEDIUM: '보통',
    LOW: '낮음',
  };

  return labels[severity] ?? value ?? '-';
}

function severityClass(value?: string | null) {
  const severity = String(value ?? '').toUpperCase();

  if (severity === 'CRITICAL') return 'border-red-200 bg-red-50 text-red-700';
  if (severity === 'HIGH') return 'border-orange-200 bg-orange-50 text-orange-700';
  if (severity === 'MEDIUM') return 'border-yellow-200 bg-yellow-50 text-yellow-700';

  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function formatFaultStatus(value?: string | null) {
  const status = String(value ?? '').toUpperCase();

  const labels: Record<string, string> = {
    OPEN: '미조치',
    IN_PROGRESS: '조치중',
    RESOLVED: '해결',
    CLOSED: '종결',
  };

  return labels[status] ?? value ?? '-';
}

function statusClass(value?: string | null) {
  const status = String(value ?? '').toUpperCase();

  if (status === 'OPEN') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'IN_PROGRESS') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (status === 'RESOLVED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'CLOSED') return 'border-slate-200 bg-slate-100 text-slate-600';

  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function formatBattery(item: DeviceFaultItem) {
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

function getParkingLotName(item: DeviceFaultItem) {
  return item.parkingSpace?.section?.parkingLot?.name ?? '-';
}

function getSectionName(item: DeviceFaultItem) {
  return item.parkingSpace?.section?.name ?? '-';
}

function getSpaceCode(item: DeviceFaultItem) {
  return item.parkingSpace?.code ?? '-';
}

function getLocationText(item: DeviceFaultItem) {
  return [getParkingLotName(item), getSectionName(item), getSpaceCode(item)]
    .filter((value) => value && value !== '-')
    .join(' / ') || '-';
}

function getDevEui(item: DeviceFaultItem) {
  return formatDevEui(item.device?.devEui ?? item.devEui);
}

function getDeviceName(item: DeviceFaultItem) {
  return item.device?.name ?? item.name ?? '-';
}

function getDeviceId(item: DeviceFaultItem) {
  return item.deviceId ?? item.device?.id ?? null;
}

function getFaultPayload(item: DeviceFaultItem) {
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

export default function DeviceFaultsPage({ role = 'admin' }: Props) {
  const { session } = useAuth();
  const [items, setItems] = useState<DeviceFaultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [detailItem, setDetailItem] = useState<DeviceFaultItem | null>(null);
  const [actionTarget, setActionTarget] = useState<DeviceFaultItem | null>(null);
  const [closeTarget, setCloseTarget] = useState<DeviceFaultItem | null>(null);
  const [actionText, setActionText] = useState('');
  const [closeText, setCloseText] = useState('');

  async function load() {
    if (!session?.accessToken) return;

    setLoading(true);
    setError('');

    try {
      const res = await apiFetch('/devices/faults', {
        accessToken: session.accessToken,
      });

      setItems(unwrapList<DeviceFaultItem>(res));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : '장치 장애 목록을 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [session?.accessToken]);

  const summary = useMemo(() => {
    return {
      total: items.length,
      critical: items.filter((item) => String(item.severity).toUpperCase() === 'CRITICAL').length,
      high: items.filter((item) => String(item.severity).toUpperCase() === 'HIGH').length,
      medium: items.filter((item) => String(item.severity).toUpperCase() === 'MEDIUM').length,
      low: items.filter((item) => String(item.severity).toUpperCase() === 'LOW').length,
    };
  }, [items]);

  async function submitAction(event: { preventDefault: () => void }) {
    event.preventDefault();

    if (!session?.accessToken || !actionTarget) return;

    const text = actionText.trim();
    if (!text) {
      setError('조치 내용을 입력해 주세요.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await apiFetch(`/devices/faults/${encodeURIComponent(actionTarget.id)}/action`, {
        method: 'POST',
        accessToken: session.accessToken,
        body: JSON.stringify({
          ...getFaultPayload(actionTarget),
          actionTaken: text,
        }),
      });

      setActionTarget(null);
      setActionText('');
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : '조치 내용을 저장하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function submitClose(event: { preventDefault: () => void }) {
    event.preventDefault();

    if (!session?.accessToken || !closeTarget) return;

    const text = closeText.trim();
    if (!text) {
      setError('종결 사유를 입력해 주세요.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await apiFetch(`/devices/faults/${encodeURIComponent(closeTarget.id)}/close`, {
        method: 'POST',
        accessToken: session.accessToken,
        body: JSON.stringify({
          ...getFaultPayload(closeTarget),
          actionResult: text,
        }),
      });

      setCloseTarget(null);
      setCloseText('');
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : '장애를 종결하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="space-y-6 p-6">
      <section className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">장치 장애</h1>
          <p className="text-sm text-slate-500">
            {role === 'admin'
              ? '전체 장치의 수신 데이터와 조치 상태를 관리합니다.'
              : '권한이 있는 장치의 수신 데이터와 조치 상태를 관리합니다.'}
          </p>
        </div>

        <button
          type="button"
          className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
          onClick={() => void load()}
        >
          새로고침
        </button>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-slate-500">전체 장애</div>
          <div className="mt-2 text-2xl font-bold">{summary.total}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-slate-500">긴급</div>
          <div className="mt-2 text-2xl font-bold text-red-600">{summary.critical}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-slate-500">높음</div>
          <div className="mt-2 text-2xl font-bold text-orange-600">{summary.high}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-slate-500">보통</div>
          <div className="mt-2 text-2xl font-bold text-yellow-600">{summary.medium}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-slate-500">낮음</div>
          <div className="mt-2 text-2xl font-bold text-slate-600">{summary.low}</div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border bg-white">
        <div className="border-b px-5 py-4">
          <div className="font-semibold">장애 분석 결과</div>
          <div className="text-sm text-slate-500">
            {loading ? '불러오는 중...' : `${items.length}개 장애 후보`}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1500px] text-sm">
            <thead className="bg-slate-50 text-center text-slate-600">
              <tr>
                <th className="px-3 py-3">번호</th>
                <th className="px-3 py-3">장애 유형</th>
                <th className="px-3 py-3">등급</th>
                <th className="px-3 py-3">장치명</th>
                <th className="px-3 py-3">DevEUI</th>
                <th className="px-3 py-3">위치</th>
                <th className="px-3 py-3">주차 상태</th>
                <th className="px-3 py-3">기기 상태</th>
                <th className="px-3 py-3">배터리</th>
                <th className="px-3 py-3">RSSI/SNR</th>
                <th className="px-3 py-3">최근 수신</th>
                <th className="px-3 py-3">조치 상태</th>
                <th className="px-3 py-3">작업</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item, index) => (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-3 text-center text-slate-500">{index + 1}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-center font-medium">
                    {item.title ?? item.code ?? '-'}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${severityClass(
                        item.severity,
                      )}`}
                    >
                      {formatSeverity(item.severity)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center">{getDeviceName(item)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-center font-mono text-xs">
                    {getDevEui(item)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center">{getLocationText(item)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-center">
                    {formatParkingStatus(item.latestTelemetry?.parkingStatus)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center">
                    {formatDeviceStatus(item.latestTelemetry?.deviceStatus)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center">{formatBattery(item)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-center">
                    {item.latestTelemetry?.rssi ?? '-'} / {item.latestTelemetry?.snr ?? '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center">
                    {formatDateTime(
                      item.latestTelemetry?.lastMessageTime ??
                        item.latestTelemetry?.time ??
                        item.detectedAt,
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusClass(
                        item.status,
                      )}`}
                    >
                      {formatFaultStatus(item.status)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button
                        type="button"
                        className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                        onClick={() => setDetailItem(item)}
                      >
                        상세
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-blue-200 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
                        onClick={() => {
                          setActionTarget(item);
                          setActionText(item.actionTaken ?? '');
                        }}
                      >
                        조치
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        onClick={() => {
                          setCloseTarget(item);
                          setCloseText(item.actionResult ?? '');
                        }}
                      >
                        종결
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {items.length === 0 && !loading ? (
                <tr>
                  <td colSpan={13} className="px-5 py-10 text-center text-slate-500">
                    현재 분석된 장치 장애가 없습니다.
                  </td>
                </tr>
              ) : null}

              {items.length === 0 && loading ? (
                <tr>
                  <td colSpan={13} className="px-5 py-10 text-center text-slate-500">
                    불러오는 중...
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {detailItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">장애 상세</h2>
                <p className="text-sm text-slate-500">{detailItem.title ?? detailItem.code}</p>
              </div>
              <button
                type="button"
                className="rounded-lg border px-3 py-1 text-sm"
                onClick={() => setDetailItem(null)}
              >
                닫기
              </button>
            </div>

            <div className="mt-5 grid gap-3 text-sm">
              <div>
                <div className="font-semibold text-slate-700">장애 사유</div>
                <div className="mt-1 rounded-xl bg-slate-50 p-3 text-slate-700">
                  {detailItem.reason ?? detailItem.description ?? '-'}
                </div>
              </div>

              <div>
                <div className="font-semibold text-slate-700">조치 내용</div>
                <div className="mt-1 rounded-xl bg-slate-50 p-3 text-slate-700">
                  {detailItem.actionTaken ?? '-'}
                </div>
              </div>

              <div>
                <div className="font-semibold text-slate-700">조치 결과 / 종결 사유</div>
                <div className="mt-1 rounded-xl bg-slate-50 p-3 text-slate-700">
                  {detailItem.actionResult ?? '-'}
                </div>
              </div>

              <div>
                <div className="font-semibold text-slate-700">최신 수신 데이터</div>
                <pre className="mt-1 max-h-64 overflow-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100">
                  {JSON.stringify(detailItem.latestTelemetry ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {actionTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={submitAction} className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold">장애 조치 등록</h2>
            <p className="mt-1 text-sm text-slate-500">
              {actionTarget.title ?? actionTarget.code} / {getDevEui(actionTarget)}
            </p>

            <label className="mt-5 block space-y-2">
              <span className="text-sm font-medium text-slate-700">조치 내용</span>
              <textarea
                value={actionText}
                onChange={(event) => setActionText(event.target.value)}
                className="h-32 w-full rounded-xl border p-3 text-sm outline-none focus:border-blue-500"
                placeholder="예: 현장 확인 후 센서 주변 이물질 제거, 배터리 상태 확인"
              />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border px-4 py-2 text-sm"
                onClick={() => {
                  setActionTarget(null);
                  setActionText('');
                }}
              >
                취소
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                저장
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {closeTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={submitClose} className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold">장애 종결</h2>
            <p className="mt-1 text-sm text-slate-500">
              종결하면 같은 장치의 같은 장애 유형은 더 이상 목록에 표시되지 않습니다.
            </p>

            <label className="mt-5 block space-y-2">
              <span className="text-sm font-medium text-slate-700">종결 사유</span>
              <textarea
                value={closeText}
                onChange={(event) => setCloseText(event.target.value)}
                className="h-32 w-full rounded-xl border p-3 text-sm outline-none focus:border-blue-500"
                placeholder="예: 조치 완료 후 정상 동작 확인"
              />
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border px-4 py-2 text-sm"
                onClick={() => {
                  setCloseTarget(null);
                  setCloseText('');
                }}
              >
                취소
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
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
