'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { API_BASE, apiFetch, getToken } from './watcher-utils';
import WatcherEnforcementAlertBanner from './watcher-enforcement-alert-banner';

export default function WatcherEnforcementPage() {
  const [items, setItems] = useState<any[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [debug, setDebug] = useState<any>(null);

  async function load() {
    setLoading(true);
    setMessage(null);
    setAuthRequired(false);

    try {
      const token = getToken();

      setDebug({
        apiBase: API_BASE,
        hasToken: Boolean(token),
        tokenLength: token.length,
        loadedAt: new Date().toLocaleString(),
      });

      const json = await apiFetch('/watcher/enforcement-cases');

      setItems(Array.isArray(json) ? json : []);
      setDebug((prev: any) => ({
        ...prev,
        itemCount: Array.isArray(json) ? json.length : 0,
        rawSample: Array.isArray(json) ? json[0] ?? null : json,
      }));
    } catch (err: any) {
      const msg = err.message ?? '단속 대상을 불러오지 못했습니다.';
      setMessage(msg);
      setItems([]);

      if (msg.includes('로그인') || msg.includes('Unauthorized')) {
        setAuthRequired(true);
      }

      setDebug((prev: any) => ({
        ...prev,
        error: msg,
      }));
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
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">단속 대상</h1>
            <p className="mt-2 text-sm text-slate-500">
              Grace time이 지난 미등록 주차면입니다.
            </p>
          </div>

          <button
            onClick={load}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
          >
            새로고침
          </button>
        </div>

        <div className="mt-4 rounded-2xl bg-slate-900 p-3 text-xs text-white">
          <p>API: {debug?.apiBase ?? API_BASE}</p>
          <p>Token: {debug?.hasToken ? `있음 (${debug?.tokenLength})` : '없음'}</p>
          <p>Items: {debug?.itemCount ?? items.length}</p>
          <p>Loaded: {debug?.loadedAt ?? '-'}</p>
        </div>

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
          <WatcherEnforcementAlertBanner />

          {loading ? (
            <div className="rounded-3xl bg-white p-6 text-sm text-slate-500 shadow-sm">
              단속 대상을 불러오는 중입니다.
            </div>
          ) : authRequired ? null : items.length === 0 ? (
            <div className="rounded-3xl bg-white p-6 text-sm text-slate-500 shadow-sm">
              현재 단속 대상이 없습니다.
            </div>
          ) : (
            items.map((item) => {
              const space =
                item.parkingSession?.ParkingSpace ??
                item.parkingSession?.parkingSpace ??
                null;

              const spaceCode =
                space?.code ??
                item.parkingSpace?.code ??
                item.parkingSpaceId ??
                '-';

              const lotName =
                item.parkingLot?.name ??
                item.parkingSession?.ParkingSpace?.section?.parkingLot?.name ??
                '-';

              return (
                <Link
                  key={item.id}
                  href={`/watcher/enforcement/${item.id}`}
                  className="block rounded-3xl bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-lg font-bold">{spaceCode}</p>
                      <p className="mt-1 text-sm text-slate-500">{lotName}</p>
                      <p className="mt-1 text-xs text-slate-400">상태: {item.status}</p>
                      <p className="mt-1 text-xs text-slate-400">Case: {item.id}</p>
                    </div>
                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-600">
                      단속
                    </span>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {debug?.rawSample && (
          <details className="mt-5 rounded-2xl bg-white p-4 text-xs shadow-sm">
            <summary className="cursor-pointer font-bold">Debug raw sample</summary>
            <pre className="mt-3 overflow-auto whitespace-pre-wrap">
              {JSON.stringify(debug.rawSample, null, 2)}
            </pre>
          </details>
        )}
      </section>
    </main>
  );
}
