'use client';

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3000/api';

type Props = {
  role: 'manager' | 'admin';
};

type WatcherApplication = {
  id: string;
  status: string;
  requestedAt?: string;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectedReason?: string | null;
  watcher?: {
    id: string;
    email?: string | null;
    name?: string | null;
    phone?: string | null;
  };
  parkingLot?: {
    id: string;
    name?: string | null;
    code?: string | null;
    address?: string | null;
    region?: string | null;
    district?: string | null;
  };
  approvedBy?: {
    email?: string | null;
    name?: string | null;
  } | null;
  rejectedBy?: {
    email?: string | null;
    name?: string | null;
  } | null;
};

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('kosmos.consoleAccessToken') ?? localStorage.getItem('kosmos.accessToken') ?? '';
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers = new Headers(options.headers ?? {});
  headers.set('content-type', headers.get('content-type') ?? 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  });

  const json = await res.json().catch(() => null);

  if (res.status === 401) {
    throw new Error('로그인이 필요합니다.');
  }

  if (!res.ok) {
    throw new Error(json?.message ?? '요청에 실패했습니다.');
  }

  return json;
}

function statusBadge(status: string) {
  if (status === 'PENDING') {
    return 'bg-amber-100 text-amber-700';
  }
  if (status === 'APPROVED') {
    return 'bg-emerald-100 text-emerald-700';
  }
  if (status === 'REJECTED') {
    return 'bg-red-100 text-red-700';
  }
  return 'bg-slate-100 text-slate-700';
}

export default function WatcherApprovalsPage({ role }: Props) {
  const [items, setItems] = useState<WatcherApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  const title = role === 'admin' ? 'Admin Watcher 승인 관리' : 'Manager Watcher 승인 관리';
  const apiPrefix = role === 'admin' ? '/admin/watcher-applications' : '/manager/watcher-applications';

  async function load() {
    setLoading(true);
    setMessage(null);

    try {
      const json = await apiFetch(apiPrefix);
      setItems(json);
    } catch (err: any) {
      setMessage(err.message ?? 'Watcher 신청 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function approve(id: string) {
    setMessage(null);

    try {
      await apiFetch(`${apiPrefix}/${id}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setMessage('승인되었습니다.');
      await load();
    } catch (err: any) {
      setMessage(err.message ?? '승인에 실패했습니다.');
    }
  }

  async function reject(id: string) {
    setMessage(null);

    try {
      await apiFetch(`${apiPrefix}/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({
          reason: rejectReason[id] ?? '',
        }),
      });
      setMessage('거절되었습니다.');
      await load();
    } catch (err: any) {
      setMessage(err.message ?? '거절에 실패했습니다.');
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-6 w-full max-w-none">
      <section className="w-full max-w-none">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-600">WATCHER APPROVAL</p>
              <h1 className="mt-1 text-2xl font-bold">{title}</h1>
              <p className="mt-2 text-sm text-slate-500">
                Watcher가 신청한 주차장 담당 권한을 승인하거나 거절합니다.
              </p>
            </div>

            <button
              onClick={load}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold"
            >
              새로고침
            </button>
          </div>

          {message && (
            <div className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm text-slate-700">
              {message}
            </div>
          )}
        </div>

        <div className="mt-5 overflow-hidden rounded-3xl bg-white shadow-sm">
          {loading ? (
            <div className="p-6 text-sm text-slate-500">불러오는 중입니다...</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">Watcher 신청 내역이 없습니다.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {items.map((item) => {
                const pending = item.status === 'PENDING';

                return (
                  <div key={item.id} className="p-6">
                    <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${statusBadge(item.status)}`}
                          >
                            {item.status}
                          </span>
                          <span className="text-xs text-slate-400">
                            신청일: {item.requestedAt ? new Date(item.requestedAt).toLocaleString() : '-'}
                          </span>
                        </div>

                        <h2 className="mt-3 text-lg font-bold">
                          {item.parkingLot?.name ?? '주차장 정보 없음'}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.parkingLot?.address ?? '-'}
                        </p>

                        <div className="mt-4 grid w-full gap-4 text-sm md:grid-cols-2">
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs font-semibold text-slate-400">신청자</p>
                            <p className="mt-1 font-semibold">{item.watcher?.name ?? '-'}</p>
                            <p className="text-slate-500">{item.watcher?.email ?? '-'}</p>
                            <p className="text-slate-500">{item.watcher?.phone ?? '-'}</p>
                          </div>

                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs font-semibold text-slate-400">주차장</p>
                            <p className="mt-1 font-semibold">{item.parkingLot?.code ?? '-'}</p>
                            <p className="text-slate-500">
                              {item.parkingLot?.region ?? '-'} {item.parkingLot?.district ?? ''}
                            </p>
                          </div>
                        </div>

                        {item.status === 'APPROVED' && (
                          <p className="mt-3 text-sm text-emerald-700">
                            승인일: {item.approvedAt ? new Date(item.approvedAt).toLocaleString() : '-'}
                          </p>
                        )}

                        {item.status === 'REJECTED' && (
                          <p className="mt-3 text-sm text-red-700">
                            거절일: {item.rejectedAt ? new Date(item.rejectedAt).toLocaleString() : '-'}
                            {item.rejectedReason ? ` · 사유: ${item.rejectedReason}` : ''}
                          </p>
                        )}
                      </div>

                      {pending && (
                        <div className="w-full shrink-0 space-y-2 lg:w-80">
                          <button
                            onClick={() => approve(item.id)}
                            className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white"
                          >
                            승인
                          </button>

                          <input
                            value={rejectReason[item.id] ?? ''}
                            onChange={(event) =>
                              setRejectReason((prev) => ({
                                ...prev,
                                [item.id]: event.target.value,
                              }))
                            }
                            placeholder="거절 사유를 입력하세요."
                            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                          />

                          <button
                            onClick={() => reject(item.id)}
                            className="w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white"
                          >
                            거절
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
