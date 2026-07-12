'use client';

import { LogOut, Moon, Settings, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/components/providers/auth-provider';
import { usePreferences } from '@/components/providers/preferences-provider';

export function UserMenu() {
  const { session, logout } = useAuth();
  const { preferences, updatePreferences } = usePreferences();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right md:block">
        <div className="text-sm font-semibold">
          {session?.user.name ?? 'Guest'}
        </div>
        <div className="text-xs text-muted">
          {(session?.user.roles ?? []).join(', ') || 'No role'}
        </div>
      </div>

      <button
        type="button"
        className="rounded-2xl border p-2"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <button
        type="button"
        className="rounded-2xl border p-2"
        onClick={() => updatePreferences({ denseMode: !preferences.denseMode })}
        title="Toggle dense mode"
      >
        <Settings size={18} />
      </button>

      <button
        type="button"
        className="rounded-2xl border p-2"
        onClick={() => logout()}
      >
        <LogOut size={18} />
      </button>
    </div>
  );
}