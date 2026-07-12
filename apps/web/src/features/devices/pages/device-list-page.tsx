'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';

type DeviceType =
  | 'PARKING_SENSOR'
  | 'IO_CONTROLLER'
  | 'DISPLAY_BOARD'
  | 'SMART_TRACKER'
  | 'SENSIO_CONTROLLER';

type DeviceRow = {
  id: string | number;
  name?: string | null;
  type: DeviceType | string;
  serialNumber?: string | null;
  serial?: string | null;
  devEui?: string | null;
  macAddress?: string | null;
  ipAddress?: string | null;
  installLocation?: string | null;
  dev_eui?: string | null;
  status?: string | number | null;
  battery?: string | number | null;
  batteryStatus?: string | number | null;
  battery_status?: string | number | null;
  lastSeen?: string | null;
  last_seen?: string | null;
  latestSensorData?: {
    device_status?: number | null;
    battery_status?: number | null;
    battery_voltage?: number | null;
    time?: string | null;
  } | null;
};

const DEVICE_TYPES: DeviceType[] = [
  'PARKING_SENSOR',
  'IO_CONTROLLER',
  'DISPLAY_BOARD',
  'SMART_TRACKER',
  'SENSIO_CONTROLLER',
];

function getSerial(device: DeviceRow) {
  return device.serialNumber ?? device.serial ?? '-';
}

function formatStatus(device: DeviceRow) {
  const raw = device.latestSensorData?.device_status ?? device.status ?? null;

  if (raw === null || raw === undefined) return '-';

  if (typeof raw === 'number') {
    if (raw === 0) return 'Normal';
    if (raw === 1) return 'Warning';
    if (raw === 2) return 'Fault';
    return String(raw);
  }

  return raw;
}

function formatBattery(device: DeviceRow) {
  const voltage = device.latestSensorData?.battery_voltage;

  if (typeof voltage === 'number') {
    return `${voltage.toFixed(2)}V`;
  }

  const raw =
    device.latestSensorData?.battery_status ??
    device.batteryStatus ??
    device.battery_status ??
    device.battery ??
    null;

  if (raw === null || raw === undefined) return '-';

  if (typeof raw === 'number') return `${raw}%`;

  return raw;
}

function formatLastSeen(device: DeviceRow) {
  const raw =
    device.latestSensorData?.time ??
    device.lastSeen ??
    device.last_seen ??
    null;

  if (!raw) return '-';

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleString();
}

export default function DeviceListPage() {
  const { session, isReady } = useAuth();

  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState<DeviceType>('PARKING_SENSOR');
  const [serialNumber, setSerialNumber] = useState('');
  const [devEui, setDevEui] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [installLocation, setInstallLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const accessToken = session?.accessToken;

  async function loadDevices() {
    if (!accessToken) {
      setLoading(false);
      setError('Unauthorized: login session is missing. Please log in again.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await apiFetch('/devices', {
        accessToken,
      });

      const rows = Array.isArray(result)
        ? result
        : result?.data ?? result?.items ?? result?.devices ?? [];

      setDevices(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isReady) return;
    void loadDevices();
  }, [isReady, accessToken]);

  const canSubmit = useMemo(() => {
    return Boolean(
      name.trim() &&
        type &&
        serialNumber.trim() &&
        devEui.trim(),
    );
  }, [name, type, serialNumber, devEui]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!canSubmit || !accessToken) {
      setError('Unauthorized: login session is missing. Please log in again.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await apiFetch('/devices', {
        method: 'POST',
        accessToken,
        body: JSON.stringify({
          name: name.trim(),
          type,
          serialNumber: serialNumber.trim(),
          devEui: devEui.trim(),
          macAddress: macAddress.trim() || null,
          ipAddress: ipAddress.trim() || null,
          installLocation: installLocation.trim() || null,
        }),
      });

      setModalOpen(false);
      setName('');
      setType('PARKING_SENSOR');
      setSerialNumber('');
      setDevEui('');
      setMacAddress('');
      setIpAddress('');
      setInstallLocation('');
      await loadDevices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add device');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">장치</h1>
          <p className="mt-1 text-sm text-slate-500">
            센서/장치 목록, 등록, 수정 관리
          </p>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          장치 추가
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
              <tr>
                <th className="px-4 py-3">번호</th>
                <th className="px-4 py-3">장치명</th>
                <th className="px-4 py-3">장치 유형</th>
                <th className="px-4 py-3">일련번호</th>
                <th className="px-4 py-3">DevEUI</th>
                <th className="px-4 py-3">MAC 주소</th>
                <th className="px-4 py-3">IP 주소</th>
                <th className="px-4 py-3">설치 위치</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">최근 수신</th>
                <th className="px-4 py-3 text-right">관리</th>
              </tr>
            </thead>

          <tbody>
              {devices.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-slate-500" colSpan={11}>
                    등록된 장치가 없습니다.
                  </td>
                </tr>
              ) : (
                devices.map((device, index) => (
                  <tr key={device.id} className="border-t">
                    <td className="px-4 py-3">{index + 1}</td>
                    <td className="px-4 py-3">{device.name ?? '-'}</td>
                    <td className="px-4 py-3">{device.type}</td>
                    <td className="px-4 py-3">{getSerial(device)}</td>
                    <td className="px-4 py-3 font-mono">{device.devEui ?? '-'}</td>
                    <td className="px-4 py-3 font-mono">{device.macAddress ?? '-'}</td>
                    <td className="px-4 py-3 font-mono">{device.ipAddress ?? '-'}</td>
                    <td className="px-4 py-3">{device.installLocation ?? '-'}</td>
                    <td className="px-4 py-3">{formatStatus(device)}</td>
                    <td className="px-4 py-3">{formatLastSeen(device)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="rounded-xl border px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        수정
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
        </table>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  장치 추가
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  장치명, 장치 유형, 일련번호, DevEUI를 입력하고 필요 시 MAC 주소, IP 주소, 설치 위치를 함께 등록합니다.
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

            <form className="space-y-4" onSubmit={onSubmit}>
              <div>
  <label className="mb-2 block text-sm font-medium">
    장치명
  </label>
  <input
    className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
    value={name}
    onChange={(e) => setName(e.target.value)}
    placeholder="Sensor-A1"
    required
  />
</div>
              <div>
                <label className="mb-2 block text-sm font-medium">장치 유형</label>
                <select
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  value={type}
                  onChange={(e) => setType(e.target.value as DeviceType)}
                >
                  {DEVICE_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  일련번호
                </label>
                <input
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="SN-000001"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">DevEUI</label>
                <input
                  className="w-full rounded-2xl border px-4 py-3 text-sm uppercase outline-none"
                  value={devEui}
                  onChange={(e) => setDevEui(e.target.value.toUpperCase())}
                  placeholder="AC1F09FFFE000001"
                  required
                />
              </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">MAC 주소</label>
                  <input
                    className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                    value={macAddress}
                    onChange={(e) => setMacAddress(e.target.value)}
                    placeholder="AA:BB:CC:DD:EE:FF"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">IP 주소</label>
                  <input
                    className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    placeholder="192.168.0.10"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">설치 위치</label>
                  <input
                    className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                    value={installLocation}
                    onChange={(e) => setInstallLocation(e.target.value)}
                    placeholder="예: A구역 입구, B-01 주차면"
                  />
                </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-2xl border px-4 py-2 text-sm font-medium"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={!canSubmit || saving}
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}