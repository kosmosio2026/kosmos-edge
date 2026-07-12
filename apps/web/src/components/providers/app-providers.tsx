'use client';

import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { AuthProvider } from './auth-provider';
import { PreferencesProvider } from './preferences-provider';
import { RealtimeProvider } from './realtime-provider';
import { ToastProvider } from './toast-provider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <PreferencesProvider>
          <RealtimeProvider>
            <ToastProvider>{children}</ToastProvider>
          </RealtimeProvider>
        </PreferencesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}