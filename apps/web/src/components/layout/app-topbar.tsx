'use client';

import { useMemo } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { useRealtime } from '@/components/providers/realtime-provider';

function getDisplayName(session: any) {
  return (
    session?.user?.name ??
    session?.name ??
    session?.user?.email ??
    session?.email ??
    '사용자'
  );
}

function getRoleLabel(session: any) {
  const roles =
    session?.roles ??
    session?.user?.roles ??
    session?.role ??
    session?.user?.role;

  if (Array.isArray(roles)) {
    return roles.join(', ');
  }

  return roles ?? '';
}

export function AppTopbar() {
  const auth = useAuth() as any;
  const realtime = useRealtime() as any;

  const session = auth?.session;
  const displayName = getDisplayName(session);
  const roleLabel = getRoleLabel(session);

  const connected = Boolean(
    realtime?.connected ??
      realtime?.isConnected ??
      realtime?.readyState === 1,
  );

  const lastEventLabel = useMemo(() => {
    const event = realtime?.lastEvent;

    if (!event || typeof event !== 'object') {
      return null;
    }

    return (
      event.eventType ??
      event.type ??
      event.name ??
      event.topic ??
      null
    );
  }, [realtime?.lastEvent]);

  function handleLogout() {
    const logout =
      auth?.logout ??
      auth?.signOut ??
      auth?.clearSession;

    if (typeof logout === 'function') {
      logout();
      return;
    }

    try {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('session');
      localStorage.removeItem('auth');
      localStorage.removeItem('parking-auth');
    } catch {
      // ignore
    }

    window.location.href = '/login';
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-6 py-3 backdrop-blur">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm font-bold text-slate-900">
            KOSMOS Edge Console
          </div>

          <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold text-slate-600">
            <span
              className={[
                'mr-2 inline-block h-2.5 w-2.5 rounded-full',
                connected ? 'animate-pulse bg-emerald-500' : 'bg-amber-500',
              ].join(' ')}
            />
            Realtime WebSocket {connected ? '연결됨' : '확인 중'}
          </div>

          {lastEventLabel ? (
            <div className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500 md:inline-flex">
              최근 이벤트: {String(lastEventLabel)}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="text-right text-xs">
            <div className="font-bold text-slate-800">{displayName}</div>
            {roleLabel ? (
              <div className="text-slate-400">{String(roleLabel)}</div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
