'use client';

import { useState } from 'react';

type Props = {
  loading?: boolean;
  onSubmit?: (values: {
    name: string;
    code: string;
    region: string;
    district: string;
    address: string;
  }) => void | Promise<void>;
};

export default function ParkingLotForm({ loading = false, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [address, setAddress] = useState('');

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onSubmit?.({
      name,
      code,
      region,
      district,
      address,
    });
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <input
        placeholder="Parking lot name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="w-full rounded-xl border px-3 py-2 text-sm"
      />

      <input
        placeholder="Code"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        className="w-full rounded-xl border px-3 py-2 text-sm"
      />

      <input
        placeholder="Region"
        value={region}
        onChange={(event) => setRegion(event.target.value)}
        className="w-full rounded-xl border px-3 py-2 text-sm"
      />

      <input
        placeholder="District"
        value={district}
        onChange={(event) => setDistrict(event.target.value)}
        className="w-full rounded-xl border px-3 py-2 text-sm"
      />

      <input
        placeholder="Address"
        value={address}
        onChange={(event) => setAddress(event.target.value)}
        className="w-full rounded-xl border px-3 py-2 text-sm"
      />

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
      >
        {loading ? 'Saving...' : 'Save'}
      </button>
    </form>
  );
}
