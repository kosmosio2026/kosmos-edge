'use client';

import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';

type SensorEventLog = {
  id: string;
  devEui: string;
  eventType: string;
  parkingStatus?: number | null;
  deviceStatus?: number | null;
  batteryStatus?: number | null;
  batteryVoltage?: number | null;
  rssi?: number | null;
  snr?: number | null;
  occurredAt: string;
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

function parkingStatusLabel(value?: number | null) {
  switch (value) {
    case 0:
      return 'Exit Normal';
    case 1:
      return 'Entry Normal';
    case 2:
      return 'Exit Obstacle';
    case 3:
      return 'Entry Obstacle';
    case 255:
      return 'Unknown';
    default:
      return value == null ? '-' : String(value);
  }
}

export default function AdminSensorStreamPage() {
  const { session } = useAuth();
  const [items, setItems] = useState<SensorEventLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError('');

    try {
      const result = await apiFetch<{ ok: boolean; items: SensorEventLog[] }>(
        '/devices/sensor-events?limit=100',
        {
          accessToken: session.accessToken,
        },
      );

      setItems(result.items ?? []);
    } catch (error) {
      setError(error instanceof Error ? error.message : '센서 스트림을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 3000);

    return () => window.clearInterval(timer);
  }, [load]);

  return (
    <main className="space-y-6 p-6">
      <section className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">센서 스트림</h1>
          <p className="text-sm text-muted-foreground">
            MQTT parking sensor events mapped to parking spaces and sessions.
          </p>
        </div>

        <button
          type="button"
          className="rounded-md border px-3 py-2 text-sm"
          onClick={() => void load()}
        >
          Refresh
        </button>
      </section>

      {error ? <p className="text-sm text-red-500">{error}</p> : null}
      {loading ? <p className="text-sm">불러오는 중...</p> : null}

      <section className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-2 text-left">Time</th>
              <th className="px-3 py-2 text-left">DevEUI</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Lot</th>
              <th className="px-3 py-2 text-left">Section</th>
              <th className="px-3 py-2 text-left">Space</th>
              <th className="px-3 py-2 text-left">RSSI/SNR</th>
              <th className="px-3 py-2 text-left">배터리</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2">
                  {new Date(item.occurredAt ?? item.createdAt).toLocaleString()}
                </td>
                <td className="px-3 py-2 font-mono">{item.devEui}</td>
                <td className="px-3 py-2">
                  {parkingStatusLabel(item.parkingStatus)}
                </td>
                <td className="px-3 py-2">
                  {item.parkingSpace?.section?.parkingLot?.name ?? '-'}
                </td>
                <td className="px-3 py-2">
                  {item.parkingSpace?.section?.name ?? '-'}
                </td>
                <td className="px-3 py-2">
                  {item.parkingSpace?.code ?? '-'}
                </td>
                <td className="px-3 py-2">
                  {item.rssi ?? '-'} / {item.snr ?? '-'}
                </td>
                <td className="px-3 py-2">
                  {item.batteryVoltage ?? item.batteryStatus ?? '-'}
                </td>
              </tr>
            ))}

            {!items.length ? (
              <tr>
                <td className="px-3 py-8 text-center" colSpan={8}>
                  No sensor events yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
