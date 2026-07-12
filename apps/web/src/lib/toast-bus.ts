'use client';

export type ToastPayload = {
  id: string;
  title: string;
  description?: string;
  variant?: 'success' | 'error' | 'info';
};

type Listener = (payload: ToastPayload) => void;

const listeners = new Set<Listener>();

export function emitToast(payload: Omit<ToastPayload, 'id'>) {
  const fullPayload: ToastPayload = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...payload,
  };

  listeners.forEach((listener) => listener(fullPayload));
}

export function subscribeToast(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}