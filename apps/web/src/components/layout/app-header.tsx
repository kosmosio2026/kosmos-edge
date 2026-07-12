'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { HeaderBar } from './header-bar';

export function AppHeader() {
  const { session } = useAuth();

  return <HeaderBar user={session?.user ?? null} />;
}
