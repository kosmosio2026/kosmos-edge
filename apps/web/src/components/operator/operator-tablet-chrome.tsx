'use client';

import { usePathname } from 'next/navigation';

import { OperatorTabletNav } from '@/components/operator/operator-tablet-nav';
import { OperatorTabletFooter } from '@/components/operator/operator-tablet-footer';

const AUTH_PATHS = [
  '/operator/login',
  '/operator/register',
  '/operator/forgot-password',
];

export function OperatorTabletChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isAuthPage = AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <>
      <OperatorTabletNav />
      <div className="min-h-[calc(100vh-160px)]">
        {children}
      </div>
      <OperatorTabletFooter />
    </>
  );
}
