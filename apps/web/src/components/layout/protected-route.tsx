'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import type { LoginRole } from '@/types/auth';

export function ProtectedLayout({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: LoginRole[];
}) {
  const { user, isReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (roles?.length && !roles.some((role) => user.roles.includes(role))) {
      router.replace('/login');
    }
  }, [user, isReady, roles, router]);

  if (!isReady) return <div className="p-6">Loading...</div>;
  if (!user) return null;

  if (roles?.length && !roles.some((role) => user.roles.includes(role))) {
    return null;
  }

  return <>{children}</>;
}