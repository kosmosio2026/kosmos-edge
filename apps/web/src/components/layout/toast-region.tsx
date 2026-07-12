'use client';

import { useEffect, useState } from 'react';
import { subscribeToast, type ToastPayload } from '@/lib/toast-bus';

export function ToastRegion() {
  const [items, setItems] = useState<ToastPayload[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToast((payload) => {
      setItems((prev) => [payload, ...prev].slice(0, 4));

      setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== payload.id));
      }, 3500);
    });

    return () => {
      void unsubscribe();
    };
  }, []);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-3">
      {items.map((item) => (
        <div
          key={item.id}
          className={[
            'pointer-events-auto rounded-2xl border bg-white px-4 py-3 shadow-lg',
            item.variant === 'success'
              ? 'border-green-200'
              : item.variant === 'error'
                ? 'border-red-200'
                : 'border-slate-200',
          ].join(' ')}
        >
          <div className="text-sm font-semibold">{item.title}</div>
          {item.description ? (
            <div className="mt-1 text-xs text-slate-500">
              {item.description}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}