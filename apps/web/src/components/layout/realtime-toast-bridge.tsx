'use client';

import { useEffect, useRef } from 'react';
import { useRealtime } from '@/components/providers/realtime-provider';
import { useToast } from '@/components/providers/toast-provider';

export function RealtimeToastBridge() {
  const { lastEvent } = useRealtime();
  const { push } = useToast();
  const lastKeyRef = useRef<string>('');

  useEffect(() => {
    if (!lastEvent) return;

    const key = `${lastEvent.event}:${JSON.stringify(lastEvent.payload)}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;

    push(`Realtime event: ${lastEvent.event}`);
  }, [lastEvent, push]);

  return null;
}