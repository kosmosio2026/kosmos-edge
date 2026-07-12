'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';

type PendingParkingLotRequest = {
  id: string;
  requesterId?: string | null;
  managerName?: string | null;
  manager이메일?: string | null;
  managerPhone?: string | null;
  type?: string | null;
  requestedParkingLotId?: string | null;
  requestedParkingLotName?: string | null;
  status?: string | null;
  createdAt?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return '-';

  try {
    return new Date(value).toLocaleString('ko-KR');
  } catch {
    return value;
  }
}

function getTypeLabel(type?: string | null) {
  if (type === 'PARKING_LOT_ACCESS' || type === 'MANAGER_LOT_ACCESS') {
    return '주차장 접근 권한';
  }

  if (type === 'PARKING_LOT_CREATION') {
    return '주차장 생성 요청';
  }

  if (type === 'MANAGER_SCOPE_ACCESS') {
    return 'Manager 범위 권한';
  }

  return type ?? '-';
}

export default function AdminManagerLotApprovalsPage() {
  const { session, isReady } = useAuth();

  const [items, setItems] = useState<PendingParkingLotRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const accessToken = session?.accessToken;

  async function load() {
    if (!accessToken) return;

    setLoading(true);
    setError('');

    try {
      const data = await apiFetch('/approval/admin/pending-parking-lots', {
        accessToken,
      });

      const list = Array.isArray(data)
        ? data
        : Array.isArray((data as any)?.items)
          ? (data as any).items
          : Array.isArray((data as any)?.data)
            ? (data as any).data
            : [];

      setItems(list);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '매니저 주차장 신청 목록을 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isReady || !accessToken) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, accessToken]);

  async function review(requestId: string, isApproved: boolean) {
    if (!accessToken) {
      setError('로그인이 필요합니다.');
      return;
    }

    setReviewingId(requestId);
    setMessage('');
    setError('');

    try {
      await apiFetch(`/approval/manager-lots/${requestId}/review`, {
        method: 'POST',
        accessToken,
        body: JSON.stringify({ status: isApproved ? 'APPROVED' : 'REJECTED' }),
      });

      setMessage(isApproved ? '신청을 승인했습니다.' : '신청을 반려했습니다.');
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '승인/반려 처리에 실패했습니다.',
      );
    } finally {
      setReviewingId('');
    }
  }

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          매니저 주차장 승인
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Manager가 신청한 주차장 접근 권한을 승인하거나 반려합니다.
        </p>
      </div>

      {message ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-700">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-5 py-3">No</th>
              <th className="px-5 py-3">신청자</th>
              <th className="px-5 py-3">신청 유형</th>
              <th className="px-5 py-3">주차장</th>
              <th className="px-5 py-3">상태</th>
              <th className="px-5 py-3">신청일</th>
              <th className="px-5 py-3 text-right">처리</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td className="px-5 py-8 text-slate-500" colSpan={7}>
                  불러오는 중...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-5 py-8 text-center text-slate-500" colSpan={7}>
                  대기 중인 매니저 주차장 신청이 없습니다.
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={item.id} className="border-t">
                  <td className="px-5 py-3">{index + 1}</td>
                  <td className="px-5 py-3">
                    <div className="font-bold text-slate-900">
                      {item.managerName ?? '-'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {item.manager이메일 ?? item.managerPhone ?? '-'}
                    </div>
                  </td>
                  <td className="px-5 py-3">{getTypeLabel(item.type)}</td>
                  <td className="px-5 py-3">
                    <div className="font-bold text-slate-900">
                      {item.requestedParkingLotName ?? '-'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {item.requestedParkingLotId ?? '-'}
                    </div>
                  </td>
                  <td className="px-5 py-3">{item.status ?? '-'}</td>
                  <td className="px-5 py-3">{formatDate(item.createdAt)}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={Boolean(reviewingId)}
                        onClick={() => void review(item.id, true)}
                        className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {reviewingId === item.id ? '처리 중...' : '승인'}
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(reviewingId)}
                        onClick={() => void review(item.id, false)}
                        className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-600 disabled:opacity-50"
                      >
                        반려
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
