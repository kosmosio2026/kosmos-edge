'use client';

import type { ReactNode } from 'react';

export function ConsoleFilterBar({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="grid gap-3 rounded-3xl border bg-white p-4 md:grid-cols-4">
      {children}
    </div>
  );
}