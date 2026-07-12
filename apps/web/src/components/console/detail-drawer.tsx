'use client';

import type { ReactNode } from 'react';

export function DetailDrawer({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <div className="text-lg font-semibold">{title}</div>
          {subtitle ? (
            <div className="text-sm text-slate-500">{subtitle}</div>
          ) : null}
        </div>
        <button
          onClick={onClose}
          className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
        >
          Close
        </button>
      </div>
      <div className="space-y-4 px-6 py-6">{children}</div>
    </div>
  );
}