'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Socket } from 'socket.io-client';
import { useAuth } from './auth-provider';
import { disconnectSocket, getSocket } from '@/lib/websocket';

type RealtimeEvent = {
  event: string;
  payload: unknown;
};

interface RealtimeContextValue {
  socket: Socket | null;
  connected: boolean;
  lastEvent: RealtimeEvent | null;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const realtimeDebug = process.env.NEXT_PUBLIC_REALTIME_DEBUG === 'true';
  const { session, isAuthenticated, isReady } = useAuth();

  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);

  useEffect(() => {
    if (!isReady) return;

    if (!isAuthenticated || !session?.accessToken) {
      disconnectSocket();
      setSocket(null);
      setConnected(false);
      return;
    }

    const s = getSocket(session.accessToken);
    setSocket(s);
    setConnected(Boolean(s.connected));

    const onConnect = () => {
      if (realtimeDebug) {
        console.info('[realtime] client connected', {
          id: s.id,
          namespace: '/realtime',
          connected: s.connected,
        });
      }
      setConnected(true);
    };

    const onDisconnect = (reason: string) => {
      if (realtimeDebug) {
        console.warn('[realtime] client disconnected', {
          reason,
          connected: s.connected,
        });
      }
      setConnected(false);
    };

    const onConnectError = (error: Error) => {
      if (realtimeDebug) {
        console.error('[realtime] client connect_error', error);
      }
      setConnected(false);
    };

    const events = [
      'payment.created',
      'payment.updated',
      'payment.failed',
      'billing.created',
      'invoice.updated',
      'space.status.changed',
      'violation.detected',
      'violation.resolved',
      'display.data.updated',
      'parking.entry',
      'parking.exit',
      'parking.register',
      'parking.violation',
      'parking.update',
    ] as const;

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);

    for (const event of events) {
      s.on(event, (payload: unknown) => {
        setLastEvent({ event, payload });
      });
    }

    if (!s.connected) {
      s.connect();
    }

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
      for (const event of events) {
        s.off(event);
      }
    };
  }, [isReady, isAuthenticated, session?.accessToken]);

  const value = useMemo(
    () => ({
      socket,
      connected,
      lastEvent,
    }),
    [socket, connected, lastEvent],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  const value = useContext(RealtimeContext);
  if (!value) {
    throw new Error('useRealtime must be used within RealtimeProvider');
  }
  return value;
}