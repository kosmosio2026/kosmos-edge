'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { useRealtime } from '@/components/providers/realtime-provider';
import { apiFetch } from '@/lib/api-client';

type Role = 'admin' | 'manager' | 'operator';

type Props = {
  role?: Role;
};

type SensorTelemetry = {
  time?: string | null;
  gateway_id?: string | null;
  dr?: number | null;
  fcnt?: number | null;
  fport?: number | null;
  rssi?: number | null;
  snr?: number | null;
  channel?: number | null;
  battery_status?: number | null;
  battery_voltage?: number | null;
  device_status?: number | string | null;
  parking_status?: number | string | null;
  firmware_version?: number | string | null;
};

type SensorRow = {
  id: string;
  name?: string | null;
  type?: string | null;
  serialNumber?: string | null;
  devEui?: string | null;
  status?: string | null;
  runtimeStatus?: string | null;
  battery?: number | null;
  batteryVoltage?: number | null;
  firmwareVersion?: string | null;
  lastSeenAt?: string | null;
  installLocation?: string | null;
  parkingSpaceId?: string | null;
  parkingSpace?: {
    code?: string | null;
    number?: string | null;
    status?: string | null;
    section?: {
      name?: string | null;
      code?: string | null;
      parkingLot?: {
        name?: string | null;
        code?: string | null;
        region?: string | null;
        district?: string | null;
      } | null;
    } | null;
  } | null;
  latestTelemetry?: SensorTelemetry | null;
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

function formatRuntimeStatus(value?: string | null) {
  if (!value) return 'UNKNOWN';

  const labels: Record<string, string> = {
    ONLINE: '온라인',
    OFFLINE: '오프라인',
    UNKNOWN: '미확인',
  };

  return labels[value] ?? value;
}

function formatDeviceStatus(value?: string | null) {
  if (!value) return '-';

  const labels: Record<string, string> = {
    ACTIVE: '활성',
    INACTIVE: '비활성',
    ONLINE: '온라인',
    OFFLINE: '오프라인',
    ERROR: '오류',
  };

  return labels[value] ?? value;
}

function formatSpaceStatus(value?: string | null) {
  if (!value) return '-';

  const labels: Record<string, string> = {
    EMPTY: '출차',
    OCCUPIED: '입차',
    OCCUPIED_UNREGISTERED: '입차 · 미등록',
    RESERVED: '예약',
    DISABLED: '비활성',
    MAINTENANCE: '점검',
  };

  return labels[value] ?? value;
}

function normalizeTelemetryCode(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return null;
  return String(value).trim().toUpperCase();
}

function formatSensorParkingStatus(value?: number | string | null) {
  const code = normalizeTelemetryCode(value);
  if (!code) return '-';

  const labels: Record<string, string> = {
    '0': '출차',
    '1': '입차',
  };

  return labels[code] ?? code;
}

function formatSensorDeviceStatus(value?: number | string | null) {
  const code = normalizeTelemetryCode(value);
  if (!code) return '-';

  if (code === '0') return '기기정상';
  if (code === '1') return '침수이상';

  if (
    ['2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E'].includes(code)
  ) {
    return 'Reserved';
  }

  if (code === 'F') return 'UNKNOWN';

  return code;
}

function getParkingLotName(item: SensorRow) {
  return item.parkingSpace?.section?.parkingLot?.name ?? '-';
}

function getSectionName(item: SensorRow) {
  return item.parkingSpace?.section?.name ?? '-';
}

function getSpaceCode(item: SensorRow) {
  return item.parkingSpace?.code ?? item.parkingSpace?.number ?? '-';
}


function getSensorNameWithSerial(item: SensorRow) {
  const name = item.name ?? '-';
  const serial = item.serialNumber?.trim();

  return serial ? `${name}(${serial})` : name;
}

function getLastSeenAt(item: SensorRow) {
  return item.lastSeenAt ?? item.latestTelemetry?.time ?? null;
}

function getBatteryVoltage(item: SensorRow) {
  return item.batteryVoltage ?? item.latestTelemetry?.battery_voltage ?? null;
}

function getFirmwareVersion(item: SensorRow) {
  return (
    item.firmwareVersion ??
    item.latestTelemetry?.firmware_version?.toString() ??
    '-'
  );
}

function getBatteryLabel(item: SensorRow) {
  const batteryCode = item.battery ?? item.latestTelemetry?.battery_status ?? null;
  const voltage = getBatteryVoltage(item);

  if (batteryCode === null && voltage === null) return '-';

  const parts = [];

  if (voltage !== null && voltage !== undefined) {
    parts.push(`${Number(voltage).toFixed(2)}V`);
  }

  if (batteryCode !== null && batteryCode !== undefined) {
    parts.push(`상태 ${batteryCode}`);
  }

  return parts.join(' / ');
}

export default function SensorsPage({ role = 'admin' }: Props) {
  const { session } = useAuth();
  const { lastEvent } = useRealtime();
  const [items, setItems] = useState<SensorRow[]>([]);
  const [selectedSensor, setSelectedSensor] = useState<SensorRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch('/devices/sensors?type=PARKING_SENSOR', {
        accessToken: session.accessToken,
      });

      setItems(unwrapList<SensorRow>(response));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : '주차감지센서 목록을 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (
      lastEvent?.event === 'device.updated' ||
      lastEvent?.event === 'sensor.updated' ||
      lastEvent?.event === 'parking.update'
    ) {
      void load();
    }
  }, [lastEvent, load]);

  const summary = useMemo(() => {
    const total = items.length;
    const online = items.filter((item) => item.runtimeStatus === 'ONLINE').length;
    const offline = items.filter((item) => item.runtimeStatus === 'OFFLINE').length;
    const mapped = items.filter((item) => Boolean(item.parkingSpaceId)).length;
    const lowBattery = items.filter((item) => {
      const voltage = getBatteryVoltage(item);
      return voltage !== null && voltage !== undefined && Number(voltage) < 3.3;
    }).length;

    return {
      total,
      online,
      offline,
      mapped,
      lowBattery,
    };
  }, [items]);

  return (
    <main className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="whitespace-nowrap text-2xl font-bold text-slate-900">
            주차감지센서
          </h1>
          <p className="text-sm text-slate-500">
            {role === 'admin'
              ? '전체 주차감지센서의 매핑, 통신 상태, 배터리, 최근 수신 정보를 확인합니다.'
              : '권한 범위 내 주차감지센서 상태를 확인합니다.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          새로고침
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-5">
        <Metric title="전체 센서" value={summary.total} />
        <Metric title="온라인" value={summary.online} />
        <Metric title="오프라인" value={summary.offline} />
        <Metric title="매핑 완료" value={summary.mapped} />
        <Metric title="저전압" value={summary.lowBattery} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <div className="font-semibold text-slate-900">
              센서 운영 현황
            </div>
            <div className="text-sm text-slate-500">
              {loading ? '불러오는 중...' : `${items.length}개 센서`}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-xs">
            <thead className="bg-slate-50 text-center text-xs font-semibold text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 text-center text-xs">번호</th>
                <th className="whitespace-nowrap px-3 py-2 text-center text-xs">센서명(일련번호)</th>
                <th className="whitespace-nowrap px-3 py-2 text-center text-xs">DevEUI</th>
                <th className="whitespace-nowrap px-3 py-2 text-center text-xs">통신</th>
                <th className="whitespace-nowrap px-3 py-2 text-center text-xs">장치 상태</th>
                <th className="whitespace-nowrap px-3 py-2 text-center text-xs">주차 상태</th>
                <th className="whitespace-nowrap px-3 py-2 text-center text-xs">센서 상태</th>
                <th className="whitespace-nowrap px-3 py-2 text-center text-xs">RSSI</th>
                <th className="whitespace-nowrap px-3 py-2 text-center text-xs">SNR</th>
                <th className="whitespace-nowrap px-3 py-2 text-center text-xs">배터리</th>
                <th className="whitespace-nowrap px-3 py-2 text-center text-xs">펌웨어</th>
                <th className="whitespace-nowrap px-3 py-2 text-center text-xs">최근 수신</th>
              </tr>
            </thead>

            <tbody>
              {items.map((item, index) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-3 py-2 text-center text-xs text-slate-500">
                    {index + 1}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs font-medium text-slate-900">
                    <button
                      type="button"
                      onClick={() => setSelectedSensor(item)}
                      className="underline-offset-2 hover:underline"
                    >
                      {getSensorNameWithSerial(item)}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-700">
                    {item.devEui ?? '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-center text-xs">
                    <StatusBadge status={item.runtimeStatus ?? 'UNKNOWN'} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-center text-xs">
                    {formatDeviceStatus(item.status)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-center text-xs">
                    {formatSensorParkingStatus(item.latestTelemetry?.parking_status)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-center text-xs">
                    {formatSensorDeviceStatus(
                      item.latestTelemetry?.device_status,
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-xs">
                    {item.latestTelemetry?.rssi ?? '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-xs">
                    {item.latestTelemetry?.snr ?? '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">{getBatteryLabel(item)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-center text-xs">
                    {getFirmwareVersion(item)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs">
                    {formatDateTime(getLastSeenAt(item))}
                  </td>
                </tr>
              ))}

              {items.length === 0 && !loading ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-5 py-10 text-center text-slate-500"
                  >
                    등록된 주차감지센서가 없습니다.
                  </td>
                </tr>
              ) : null}

              {loading ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-5 py-10 text-center text-slate-500"
                  >
                    불러오는 중...
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {selectedSensor ? (
        <SensorDetailModal
          sensor={selectedSensor}
          onClose={() => setSelectedSensor(null)}
        />
      ) : null}
    </main>
  );
}

function SensorDetailModal({
  sensor,
  onClose,
}: {
  sensor: SensorRow;
  onClose: () => void;
}) {
  const sensorName = getSensorNameWithSerial(sensor);
  const parkingLotName = getParkingLotName(sensor);
  const sectionName = getSectionName(sensor);
  const spaceCode = getSpaceCode(sensor);
  const lastSeenAt = getLastSeenAt(sensor);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              센서 상세정보
            </h2>
            <p className="mt-1 text-sm text-slate-500">{sensorName}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
          >
            닫기
          </button>
        </div>

        <dl className="mt-5 grid grid-cols-[120px_1fr] gap-x-4 gap-y-3 rounded-2xl border bg-slate-50 p-4 text-sm">
          <DetailRow label="센서명" value={sensorName} strong />
          <DetailRow label="일련번호" value={sensor.serialNumber ?? '-'} />
          <DetailRow label="DevEUI" value={formatDevEui(sensor.devEui)} mono />
          <DetailRow label="주차장" value={parkingLotName} />
          <DetailRow label="구역" value={sectionName} />
          <DetailRow
            label="주차면"
            value={sensor.parkingSpaceId ? spaceCode : '미매핑'}
          />
          <DetailRow label="통신" value={formatRuntimeStatus(sensor.runtimeStatus)} />
          <DetailRow label="장치 상태" value={formatDeviceStatus(sensor.status)} />
          <DetailRow
            label="주차 상태"
            value={formatSensorParkingStatus(sensor.latestTelemetry?.parking_status)}
          />
          <DetailRow
            label="센서 상태"
            value={formatSensorDeviceStatus(sensor.latestTelemetry?.device_status)}
          />
          <DetailRow label="RSSI" value={sensor.latestTelemetry?.rssi ?? '-'} />
          <DetailRow label="SNR" value={sensor.latestTelemetry?.snr ?? '-'} />
          <DetailRow label="배터리" value={getBatteryLabel(sensor)} />
          <DetailRow label="펀웨어" value={getFirmwareVersion(sensor)} />
          <DetailRow label="설치 위치" value={sensor.installLocation ?? '-'} />
          <DetailRow label="최근 수신" value={formatDateTime(lastSeenAt)} />
        </dl>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  strong = false,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
  mono?: boolean;
}) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd
        className={`text-slate-900 ${strong ? 'font-medium' : ''} ${
          mono ? 'font-mono text-xs' : ''
        }`}
      >
        {value}
      </dd>
    </>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status || 'UNKNOWN';

  const tone =
    normalized === 'ONLINE'
      ? 'bg-emerald-50 text-emerald-700'
      : normalized === 'OFFLINE'
        ? 'bg-red-50 text-red-700'
        : 'bg-slate-100 text-slate-600';

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
      {formatRuntimeStatus(normalized)}
    </span>
  );
}
