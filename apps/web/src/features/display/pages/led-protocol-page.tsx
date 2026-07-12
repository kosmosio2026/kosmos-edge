'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  sendInsertAd,
  sendDeleteAd,
  sendPower,
  sendBrightness,
} from '@/lib/led-api';

export default function LedProtocolPage() {
  const { session } = useAuth();

  const [text, setText] = useState('');
  const [brightness, setBrightness] = useState(5);
  const [power, setPower] = useState(true);

  const onSendAd = async () => {
    if (!session?.accessToken) return;

    const dataString = `LNE=1,YSZ=2,EFF=040004000400,SPD=2,DLY=1,NEN=0,FIX=0,TXT=${text}`;
    await sendInsertAd(session.accessToken, { dataString });
  };

  const onSetPower = async () => {
    if (!session?.accessToken) return;
    await sendPower(session.accessToken, { on: power });
  };

  const onSetBrightness = async () => {
    if (!session?.accessToken) return;
    await sendBrightness(session.accessToken, { level: brightness });
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">LED Display Control</h1>

      <div className="rounded-3xl border bg-white p-6 space-y-4">
        <h2 className="font-semibold">Send Text Ad</h2>
        <input
          className="border p-2 rounded w-full"
          placeholder="전광판에 보낼 문구"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          onClick={onSendAd}
          className="px-4 py-2 rounded bg-blue-600 text-white"
        >
          Send
        </button>
      </div>

      <div className="rounded-3xl border bg-white p-6 space-y-4">
        <h2 className="font-semibold">Power</h2>
        <button
          onClick={onSetPower}
          className="px-4 py-2 rounded bg-slate-800 text-white"
        >
          {power ? 'Turn OFF' : 'Turn ON'}
        </button>
      </div>

      <div className="rounded-3xl border bg-white p-6 space-y-4">
        <h2 className="font-semibold">Brightness</h2>
        <input
          type="range"
          min={1}
          max={10}
          value={brightness}
          onChange={(e) => setBrightness(Number(e.target.value))}
        />
        <button
          onClick={onSetBrightness}
          className="px-4 py-2 rounded bg-green-600 text-white"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
