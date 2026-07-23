'use client';

import { ShieldCheck } from 'lucide-react';
import { UserMenu } from './user-menu';
import { useRealtime } from '@/components/providers/realtime-provider';
import type { AuthUser } from '@/types/auth';
import { APP_VERSION_LABEL } from '@/lib/app-version';

export function HeaderBar({ user }: { user: AuthUser | null }) {
  const { connected, socket } = useRealtime();
  const realtimeConnected = connected || Boolean(socket?.connected);

  return (
    <header className="sticky top-0 z-30 border-b bg-card/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-white">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5 text-sm font-semibold">
              <span>KOSMOS 스마트 주차관제 플랫폼</span>
              <span className="text-xs font-medium text-muted-foreground">
                {APP_VERSION_LABEL}
              </span>
            </div>
            <div className="text-xs text-muted">
              {user ? `${user.name} · ${user.roles.join(', ')}` : 'Edge-first operations console'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden rounded-full border px-3 py-1 text-xs md:block">
            Realtime: {realtimeConnected ? 'Connected' : 'Disconnected'}
          </div>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}