'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';

type SensorEventLog = {
  id: string;
  devEui: string;
  eventType?: string | null;
  parkingStatus?: number | string | null;
  deviceStatus?: number | string | null;
  batteryStatus?: number | string | null;
  batteryVoltage?: number | null;
  firmwareVersion?: number | string | null;
  gatewayId?: string | null;
  rssi?: number | null;
  snr?: number | null;
  dr?: number | null;
  fCnt?: number | null;
  fcnt?: number | null;
  fPort?: number | null;
  fport?: number | null;
  channel?: number | null;
  occurredAt?: string | null;
  createdAt: string;
  parkingSpace?: {
    code?: string | null;
    section?: {
      name?: string | null;
      parkingLot?: {
        name?: string | null;
        code?: string | null;
      } | null;
    } | null;
  } | null;
};

function normalizeTelemetryCode(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return null;
  return String(value).trim().toUpperCase();
}

function formatParkingStatus(value?: number | string | null) {
  const code = normalizeTelemetryCode(value);
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
  const code = normalizeTelemetryCode(value);
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

function normalizeDevEui(value?: string | null) {
  return String(value ?? '').trim().replace(/[\s:-]/g, '').toUpperCase();
}

function formatDevEui(value?: string | null) {
  return normalizeDevEui(value) || '-';
}

function formatBattery(item: SensorEventLog) {
  const voltage = item.batteryVoltage;
  const status = item.batteryStatus;

  if (
    voltage === null &&
    voltage === undefined &&
    status === null &&
    status === undefined
  ) {
    return '-';
  }

  const parts: string[] = [];

  if (voltage !== null && voltage !== undefined) {
    parts.push(`${Number(voltage).toFixed(2)}V`);
  }

  if (status !== null && status !== undefined) {
    parts.push(`상태 ${status}`);
  }

  return parts.join(' / ');
}

function getEventTime(item: SensorEventLog) {
  return item.occurredAt ?? item.createdAt;
}

function getFCnt(item: SensorEventLog) {
  return item.fCnt ?? item.fcnt ?? null;
}

function getFPort(item: SensorEventLog) {
  return item.fPort ?? item.fport ?? null;
}

function getParkingLotName(item: SensorEventLog) {
  return item.parkingSpace?.section?.parkingLot?.name ?? '-';
}

function getSectionName(item: SensorEventLog) {
  return item.parkingSpace?.section?.name ?? '-';
}

function getSpaceCode(item: SensorEventLog) {
  return item.parkingSpace?.code ?? '-';
}

export default function AdminSensorStreamPage() {
  const { session } = useAuth();
  const [items, setItems] = useState<SensorEventLog[]>([]);
  const [devEuiFilter, setDevEuiFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError('');

    try {
      const query = new URLSearchParams({
        limit: '100',
      });

      const keyword = devEuiFilter.trim();
      if (keyword) {
        query.set('devEui', keyword);
      }

      const result = await apiFetch<{ ok?: boolean; items?: SensorEventLog[] }>(
        `/devices/sensor-events?${query.toString()}`,
        {
          accessToken: session.accessToken,
        },
      );

      setItems(result.items ?? []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : '센서 수신 이력을 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, devEuiFilter]);

  useEffect(() => {
    void load();

    const timer = window.setInterval(() => {
      void load();
    }, 3000);

    return () => window.clearInterval(timer);
  }, [load]);

  const filteredItems = useMemo(() => {
    const keyword = normalizeDevEui(devEuiFilter);

    if (!keyword) return items;

    return items.filter((item) =>
      normalizeDevEui(item.devEui).includes(keyword),
    );
  }, [items, devEuiFilter]);

  return (
    <main className="space-y-6 p-6">
      <section className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            센서 수신 이력
          </h1>
          <p className="text-sm text-slate-500">
            주차감지센서에서 수신된 최근 이벤트와 telemetry 값을 확인합니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            value={devEuiFilter}
            onChange={(event) => setDevEuiFilter(event.target.value)}
            placeholder="DevEUI 검색"
            className="w-64 rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
          />

          <button
            type="button"
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
            onClick={() => void load()}
          >
            새로고침
          </button>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <div className="font-semibold text-slate-900">
              최근 수신 이벤트
            </div>
            <div className="text-sm text-slate-500">
              {loading ? '불러오는 중...' : `${filteredItems.length}개 이벤트`}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1480px] text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th className="px-3 py-3 text-center">번호</th>
                <th className="px-3 py-3 text-center">수신 시간</th>
                <th className="px-3 py-3 text-center">DevEUI</th>
                <th className="px-3 py-3 text-center">이벤트</th>
                <th className="px-3 py-3 text-center">주차장</th>
                <th className="px-3 py-3 text-center">구역</th>
                <th className="px-3 py-3 text-center">주차면</th>
                <th className="px-3 py-3 text-center">주차 상태</th>
                <th className="px-3 py-3 text-center">기기 상태</th>
                <th className="px-3 py-3 text-center">RSSI</th>
                <th className="px-3 py-3 text-center">SNR</th>
                <th className="px-3 py-3 text-center">DR</th>
                <th className="px-3 py-3 text-center">FCnt</th>
                <th className="px-3 py-3 text-center">FPort</th>
                <th className="px-3 py-3 text-center">채널</th>
                <th className="px-3 py-3 text-center">배터리</th>
                <th className="px-3 py-3 text-center">펌웨어</th>
              </tr>
            </thead>

            <tbody>
              {filteredItems.map((item, index) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-3 py-3 text-center text-slate-500">
                    {index + 1}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center">
                    {formatDateTime(getEventTime(item))}
                  </td>
                  <td className="px-3 py-3 text-center font-mono text-xs">
                    {item.devEui}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {item.eventType ?? '-'}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {getParkingLotName(item)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {getSectionName(item)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {getSpaceCode(item)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {formatParkingStatus(item.parkingStatus)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {formatDeviceStatus(item.deviceStatus)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {item.rssi ?? '-'}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {item.snr ?? '-'}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {item.dr ?? '-'}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {getFCnt(item) ?? '-'}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {getFPort(item) ?? '-'}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {item.channel ?? '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center">
                    {formatBattery(item)}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {item.firmwareVersion ?? '-'}
                  </td>
                </tr>
              ))}

              {!filteredItems.length && !loading ? (
                <tr>
                  <td
                    className="px-3 py-10 text-center text-slate-500"
                    colSpan={17}
                  >
                    수신된 센서 이벤트가 없습니다.
                  </td>
                </tr>
              ) : null}

              {loading && !items.length ? (
                <tr>
                  <td
                    className="px-3 py-10 text-center text-slate-500"
                    colSpan={17}
                  >
                    불러오는 중...
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
