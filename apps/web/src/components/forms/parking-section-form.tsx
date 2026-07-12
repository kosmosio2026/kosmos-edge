'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ParkingSectionFormProps {
  parkingLots: Array<{ id: string; name: string }>;
  initialValue?: {
    parkingLotId?: string;
    name?: string;
    code?: string;
  };
  onSubmit: (value: {
    parkingLotId: string;
    name: string;
    code: string;
  }) => Promise<void>;
}

export function ParkingSectionForm({
  parkingLots,
  initialValue,
  onSubmit,
}: ParkingSectionFormProps) {
  const [parkingLotId, setParkingLotId] = useState(initialValue?.parkingLotId ?? '');
  const [name, setName] = useState(initialValue?.name ?? '');
  const [code, setCode] = useState(initialValue?.code ?? '');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({ parkingLotId, name, code });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <select
        className="h-11 w-full rounded-2xl border bg-card px-4 text-sm"
        value={parkingLotId}
        onChange={(e) => setParkingLotId(e.target.value)}
      >
        <option value="">Select parking lot</option>
        {parkingLots.map((lot) => (
          <option key={lot.id} value={lot.id}>
            {lot.name}
          </option>
        ))}
      </select>

      <Input placeholder="Section name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="Section code" value={code} onChange={(e) => setCode(e.target.value)} />
      <Button disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
    </form>
  );
}