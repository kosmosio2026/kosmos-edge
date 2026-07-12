'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from './watcher-utils';

export default function WatcherLogsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setMessage(null);
    setAuthRequired(false);

    try {
      const json = await apiFetch('/watcher/registration-proxy-logs');
      setItems(json);
    } catch (err: any) {
      const msg = err.message ?? '직권 등록 이력을 불러오지 못했습니다.';
      setMessage(msg);
      setItems([]);

      if (msg.includes('로그인') || msg.includes('Unauthorized')) {
        setAuthRequired(true);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 w-full max-w-none">
      <section className="w-full max-w-none">
        <h1 className="text-2xl font-bold">직권 등록 이력</h1>

        {message && (
          <div className="mt-4 rounded-2xl bg-red-50 p-3 text-sm text-red-600">
            <p>{message}</p>
            {authRequired && (
              <a href="/watcher" className="mt-2 inline-block font-bold underline">
                Watcher 로그인/회원가입 화면으로 이동
              </a>
            )}
          </div>
        )}

        <div className="mt-5 space-y-3">
          {loading ? (
            <div className="rounded-3xl bg-white p-6 text-sm text-slate-500 shadow-sm">
              직권 등록 이력을 불러오는 중입니다.
            </div>
          ) : authRequired ? null : items.length === 0 ? (
            <div className="rounded-3xl bg-white p-6 text-sm text-slate-500 shadow-sm">
              직권 등록 이력이 없습니다.
            </div>
          ) : (
            items.map((item) => {
              const space = item.parkingSession?.ParkingSpace;
              return (
                <div key={item.id} className="rounded-3xl bg-white p-5 shadow-sm">
                  <p className="text-lg font-bold">{item.vehiclePlateNumber}</p>
                  <p className="mt-1 text-sm text-slate-500">주차면: {space?.code ?? '-'}</p>
                  <p className="mt-1 text-sm text-slate-500">연락처: {item.contactPhone ?? '-'}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
