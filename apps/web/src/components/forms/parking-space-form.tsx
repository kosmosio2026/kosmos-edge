'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ParkingSpaceFormProps {
  sections: Array<{ id: string; name: string }>;
  initialValue?: {
    sectionId?: string;
    code?: string;
    number?: string;
    type?: string;
  };
  onSubmit: (value: {
    sectionId: string;
    code: string;
    number: string;
    type: string;
  }) => Promise<void>;
}

export function ParkingSpaceForm({
  sections,
  initialValue,
  onSubmit,
}: ParkingSpaceFormProps) {
  const [sectionId, setSectionId] = useState(initialValue?.sectionId ?? '');
  const [code, setCode] = useState(initialValue?.code ?? '');
  const [number, setNumber] = useState(initialValue?.number ?? '');
  const [type, setType] = useState(initialValue?.type ?? 'NORMAL');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({ sectionId, code, number, type });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <select
        className="h-11 w-full rounded-2xl border bg-card px-4 text-sm"
        value={sectionId}
        onChange={(e) => setSectionId(e.target.value)}
      >
        <option value="">Select section</option>
        {sections.map((section) => (
          <option key={section.id} value={section.id}>
            {section.name}
          </option>
        ))}
      </select>

      <Input placeholder="Space code" value={code} onChange={(e) => setCode(e.target.value)} />
      <Input placeholder="Space number" value={number} onChange={(e) => setNumber(e.target.value)} />

      <select
        className="h-11 w-full rounded-2xl border bg-card px-4 text-sm"
        value={type}
        onChange={(e) => setType(e.target.value)}
      >
        <option value="NORMAL">NORMAL</option>
        <option value="EV">EV</option>
        <option value="DISABLED">DISABLED</option>
        <option value="VIP">VIP</option>
      </select>

      <Button disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
    </form>
  );
}