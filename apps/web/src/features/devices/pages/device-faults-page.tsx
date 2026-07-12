'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';

type Props = {
  role?: 'admin' | 'manager' | 'operator';
};

type DeviceFaultItem = {
  id: string;
  devEui?: string | null;
  name?: string | null;
  grade?: string | null;
  reason?: string | null;
  status?: string | null;
  title?: string | null;
  description?: string | null;
  code?: string | null;
  severity?: string | null;
  detectedAt?: string | null;
  createdAt?: string | null;
  device?: {
      name?: string | null;
    devEui?: string | null;
    type?: string | null;
    status?: string | null;
  } | null;
};

function unwrapList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (value && typeof value === 'object') {
    const obj = value as {
      items?: unknown;
      data?: unknown;
    };

    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];

    if (
      obj.data &&
      typeof obj.data === 'object' &&
      Array.isArray((obj.data as { items?: unknown }).items)
    ) {
      return (obj.data as { items: T[] }).items;
    }
  }

  return [];
}

export default function DeviceFaultsPage({ role = 'admin' }: Props) {
  const { session } = useAuth();
  const [items, setItems] = useState<DeviceFaultItem[]>([]);

  async function load() {
    if (!session?.accessToken) return;

    const res = await apiFetch('/devices/faults', {
      accessToken: session.accessToken,
    });

    setItems(unwrapList<DeviceFaultItem>(res));
  }

  useEffect(() => {
    void load();
  }, [session?.accessToken]);

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">장치 장애</h1>
        <p className="text-sm text-slate-500">
          {role === 'admin' ? '전체 장치 장애를 관리합니다.' : '권한이 있는 장치 장애를 관리합니다.'}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-5 py-3">번호</th>
              <th className="px-5 py-3">장치명</th>
              <th className="px-5 py-3">장치 유형</th>
              <th className="px-5 py-3">DevEui</th>
              <th className="px-5 py-3">장애 유형</th>
              <th className="px-5 py-3">등급</th>
              <th className="px-5 py-3">사유</th>
              <th className="px-5 py-3">장치 상태</th>
              <th className="px-5 py-3">발생일시</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item, index) => (
              <tr key={item.id} className="border-t">
                <td className="px-5 py-3">{index + 1}</td>
                <td className="px-5 py-3">{item.device?.name ?? item.name ?? '-'}</td>
                <td className="px-5 py-3">{item.device?.type ?? '-'}</td>
                <td className="px-5 py-3 font-mono">{item.device?.devEui ?? item.devEui ?? '-'}</td>
                <td className="px-5 py-3">{item.title ?? item.code ?? '-'}</td>
                <td className="px-5 py-3">{item.severity ?? '-'}</td>
                <td className="px-5 py-3">{item.reason ?? item.description ?? '-'}</td>
                <td className="px-5 py-3">{item.status ?? item.device?.status ?? '-'}</td>
                <td className="px-5 py-3">
                  {item.detectedAt ? new Date(item.detectedAt).toLocaleString() : '-'}
                </td>
              </tr>
            ))}

            {items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-slate-500">
                  등록된 장치 장애가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
