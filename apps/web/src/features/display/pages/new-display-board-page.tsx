'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { fetchParkingLots } from '@/lib/fetchers';
import { useAuth } from '@/components/providers/auth-provider';
import { createDisplayController } from '@/lib/display-api';

type ParkingLot = {
  id: string;
  name: string;
  code?: string | null;
  region?: string | null;
};

export default function NewDisplayBoardPage() {
  const router = useRouter();
  const { session } = useAuth();

  const [lots, setLots] = useState<ParkingLot[]>([]);
  const [region, setRegion] = useState('SEOUL');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    macAddress: '',
    parkingLotId: '',
    protocolMode: 'ethernet',
    tcpHost: '',
    tcpPort: 5000,
    serialPort: '',
    baudRate: 9600,
    modbusHost: '',
    modbusPort: 502,
    modbusUnitId: 1,
  });

  useEffect(() => {
    if (!session?.accessToken) return;

    fetchParkingLots(session.accessToken).then((res) => {
      const data = res as any;
      const items = Array.isArray(data)
        ? data
        : data?.items ?? data?.data ?? data?.data?.items ?? [];

      setLots(items);
    });
  }, [session?.accessToken]);

  const regions = useMemo(() => {
    const values = lots
      .map((lot) => lot.region?.toUpperCase())
      .filter(Boolean) as string[];

    return Array.from(new Set(['SEOUL', ...values]));
  }, [lots]);

  const filteredLots = useMemo(() => {
    return lots.filter((lot) => lot.region?.toUpperCase() === region);
  }, [lots, region]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.accessToken) {
      setError('Login session is missing.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await createDisplayController(
  {
    name: form.name.trim(),
    deviceId: form.macAddress.trim(),
    macAddress: form.macAddress.trim(),
    parkingLotId: form.parkingLotId.trim() || null,
  },
  {
    accessToken: session.accessToken,
  },
);

      router.push('/admin/display/boards');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add display.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-slate-50 p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-2xl rounded-3xl border bg-white p-6 shadow-xl"
      >
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Add Display</h1>
          <p className="text-sm text-slate-500">
            Register a new display board controller.
          </p>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Display Name"
            value={form.name}
            onChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
            placeholder="Display Seoul HQ"
            required
          />

          <Input
            label="MAC Address"
            value={form.macAddress}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, macAddress: value }))
            }
            placeholder="00:11:22:33:44:55"
            required
          />

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Region</span>
            <select
              value={region}
              onChange={(event) => {
                setRegion(event.target.value);
                setForm((prev) => ({ ...prev, parkingLotId: '' }));
              }}
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              {regions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Parking Lot
            </span>
            <select
              value={form.parkingLotId}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  parkingLotId: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="">Select parking lot</option>
              {filteredLots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.name} {lot.code ? `(${lot.code})` : ''}
                </option>
              ))}
            </select>
          </label>

          <Input
            label="Parking Lot ID"
            value={form.parkingLotId}
            onChange={(value) =>
              setForm((prev) => ({ ...prev, parkingLotId: value }))
            }
            placeholder="Auto-filled by parking lot selection"
          />

          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Protocol Mode
            </span>
            <select
              value={form.protocolMode}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  protocolMode: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="ethernet">Ethernet / TCP</option>
              <option value="serial">Serial</option>
              <option value="rs485">RS485 / Modbus</option>
            </select>
          </label>

          {form.protocolMode === 'ethernet' ? (
            <>
              <Input
                label="TCP Host"
                value={form.tcpHost}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, tcpHost: value }))
                }
                placeholder="192.168.0.100"
              />
              <NumberInput
                label="TCP Port"
                value={form.tcpPort}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, tcpPort: value }))
                }
              />
            </>
          ) : null}

          {form.protocolMode === 'serial' ? (
            <>
              <Input
                label="Serial Port"
                value={form.serialPort}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, serialPort: value }))
                }
                placeholder="/dev/ttyUSB0"
              />
              <NumberInput
                label="Baud Rate"
                value={form.baudRate}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, baudRate: value }))
                }
              />
            </>
          ) : null}

          {form.protocolMode === 'rs485' ? (
            <>
              <Input
                label="Modbus Host"
                value={form.modbusHost}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, modbusHost: value }))
                }
                placeholder="192.168.0.120"
              />
              <NumberInput
                label="Modbus Port"
                value={form.modbusPort}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, modbusPort: value }))
                }
              />
              <NumberInput
                label="Modbus Unit ID"
                value={form.modbusUnitId}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, modbusUnitId: value }))
                }
              />
            </>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Create Display'}
          </button>
        </div>
      </form>
    </main>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
      />
    </label>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
      />
    </label>
  );
}