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

function statusLabel(status: string) {
  if (status === 'PENDING') return '대기';
  if (status === 'APPROVED') return '승인';
  if (status === 'REJECTED') return '거절';
  return status || '-';
}

function formatDate(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function getHandler(item: WatcherApplication) {
  if (item.status === 'APPROVED') {
    return item.approvedBy?.name ?? item.approvedBy?.email ?? '-';
  }

  if (item.status === 'REJECTED') {
    return item.rejectedBy?.name ?? item.rejectedBy?.email ?? '-';
  }

  return '-';
}

function getWatcherName(item: WatcherApplication) {
  return item.watcher?.name ?? '-';
}

function getWatcherEmail(item: WatcherApplication) {
  return item.watcher?.email ?? '-';
}

function getWatcherPhone(item: WatcherApplication) {
  return item.watcher?.phone ?? '-';
}

function getParkingLotRegion(item: WatcherApplication) {
  return [item.parkingLot?.region, item.parkingLot?.district]
    .filter(Boolean)
    .join(' ') || '-';
}

export default function WatcherApprovalsPage({ role }: Props) {
  const [items, setItems] = useState<WatcherApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [selectedDetail, setSelectedDetail] = useState<WatcherApplication | null>(null);

  const title = role === 'admin' ? 'Watcher 승인 관리' : 'Watcher 승인 관리';
  const apiPrefix = role === 'admin' ? '/admin/watcher-applications' : '/manager/watcher-applications';

  async function load() {
    setLoading(true);
    setMessage(null);

    try {
      const json = await apiFetch(apiPrefix);
      setItems(Array.isArray(json) ? json : []);
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
    void load();
  }, []);

  return (
    <main className="min-h-screen w-full max-w-none bg-slate-50 px-6 py-6">
      <section className="w-full max-w-none space-y-5">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold text-blue-600">WATCHER APPROVAL</p>
              <h1 className="mt-1 text-2xl font-bold">{title}</h1>
              <p className="mt-2 text-sm text-slate-500">
                Watcher가 신청한 주차장 담당 권한을 테이블에서 승인하거나 거절합니다.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void load()}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              새로고침
            </button>
          </div>

          {message ? (
            <div className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm text-slate-700">
              {message}
            </div>
          ) : null}
        </div>

        <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
          {loading ? (
            <div className="p-6 text-sm text-slate-500">불러오는 중입니다...</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">Watcher 신청 내역이 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3">번호</th>
                    <th className="whitespace-nowrap px-4 py-3">상태</th>
                    <th className="whitespace-nowrap px-4 py-3">신청자</th>
                    <th className="whitespace-nowrap px-4 py-3">전화번호</th>
                    <th className="whitespace-nowrap px-4 py-3">주차장</th>
                    <th className="whitespace-nowrap px-4 py-3">지역</th>
                    <th className="whitespace-nowrap px-4 py-3">신청일</th>
                    <th className="whitespace-nowrap px-4 py-3">처리 정보</th>
                    <th className="whitespace-nowrap px-4 py-3">관리</th>
                  </tr>
                </thead>

                <tbody>
                  {items.map((item, index) => {
                    const pending = item.status === 'PENDING';
                    const parkingLotName = item.parkingLot?.name ?? '주차장 정보 없음';
                    const parkingLotCode = item.parkingLot?.code ?? '-';
                    const region = getParkingLotRegion(item);

                    return (
                      <tr key={item.id} className="border-t align-top">
                        <td className="whitespace-nowrap px-4 py-3">{index + 1}</td>

                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${statusBadge(item.status)}`}
                          >
                            {statusLabel(item.status)}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 font-semibold">
                          <button
                            type="button"
                            onClick={() => setSelectedDetail(item)}
                            className="text-left font-semibold text-blue-600 underline-offset-2 hover:underline"
                          >
                            {getWatcherName(item)}
                          </button>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {getWatcherPhone(item)}
                        </td>

                        <td className="px-4 py-3">
                          <div className="whitespace-nowrap font-semibold text-slate-900">
                            {parkingLotName}
                          </div>
                          <div className="mt-1 whitespace-nowrap text-xs text-slate-500">
                            코드: {parkingLotCode}
                          </div>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {region}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {formatDate(item.requestedAt)}
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          {item.status === 'APPROVED' ? (
                            <div className="whitespace-nowrap">
                              <div>승인일: {formatDate(item.approvedAt)}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                처리자: {getHandler(item)}
                              </div>
                            </div>
                          ) : item.status === 'REJECTED' ? (
                            <div className="whitespace-nowrap">
                              <div>거절일: {formatDate(item.rejectedAt)}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                처리자: {getHandler(item)}
                              </div>
                              {item.rejectedReason ? (
                                <div className="mt-1 text-xs text-red-600">
                                  사유: {item.rejectedReason}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            '-'
                          )}
                        </td>

                        <td className="px-4 py-3">
                          {pending ? (
                            <div className="flex min-w-[260px] flex-col gap-2">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => void approve(item.id)}
                                  className="whitespace-nowrap rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                                >
                                  승인
                                </button>

                                <button
                                  type="button"
                                  onClick={() => void reject(item.id)}
                                  className="whitespace-nowrap rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
                                >
                                  거절
                                </button>
                              </div>

                              <input
                                value={rejectReason[item.id] ?? ''}
                                onChange={(event) =>
                                  setRejectReason((prev) => ({
                                    ...prev,
                                    [item.id]: event.target.value,
                                  }))
                                }
                                placeholder="거절 사유"
                                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-blue-500"
                              />
                            </div>
                          ) : (
                            <span className="whitespace-nowrap text-xs text-slate-400">처리 완료</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {selectedDetail ? (
        <WatcherDetailModal
          item={selectedDetail}
          onClose={() => setSelectedDetail(null)}
        />
      ) : null}
    </main>
  );
}

function WatcherDetailModal({
  item,
  onClose,
}: {
  item: WatcherApplication;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Watcher 신청 상세정보</h2>
            <p className="mt-1 text-sm text-slate-500">{getWatcherName(item)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-3 py-1 text-sm hover:bg-slate-50"
          >
            닫기
          </button>
        </div>

        <div className="space-y-3 text-sm">
          <DetailRow label="신청자" value={getWatcherName(item)} />
          <DetailRow label="이메일" value={getWatcherEmail(item)} />
          <DetailRow label="전화번호" value={getWatcherPhone(item)} />
          <DetailRow label="상태" value={statusLabel(item.status)} />
          <DetailRow label="신청일" value={formatDate(item.requestedAt)} />
          <DetailRow label="주차장" value={item.parkingLot?.name ?? '-'} />
          <DetailRow label="주차장 코드" value={item.parkingLot?.code ?? '-'} />
          <DetailRow label="지역" value={getParkingLotRegion(item)} />
          <DetailRow label="주소" value={item.parkingLot?.address ?? '-'} />
          <DetailRow label="처리자" value={getHandler(item)} />
          <DetailRow label="승인일" value={formatDate(item.approvedAt)} />
          <DetailRow label="거절일" value={formatDate(item.rejectedAt)} />
          <DetailRow label="거절 사유" value={item.rejectedReason ?? '-'} />
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-2">
      <span className="whitespace-nowrap text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value ?? '-'}</span>
    </div>
  );
}