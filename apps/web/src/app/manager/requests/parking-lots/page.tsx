'use client';

import { useState } from 'react';
import ParkingLotRegionFilter from '@/features/facilities/components/parking-lot-region-filter';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';

export default function ManagerParkingLotRequestsPage() {
  const { session } = useAuth();

  const [parkingLotId, setParkingLotId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const accessToken = session?.accessToken;

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      setError('로그인이 필요합니다.');
      return;
    }

    if (!parkingLotId) {
      setError('주차장을 선택하세요.');
      return;
    }

    setSaving(true);
    setMessage('');
    setError('');

    try {
      await apiFetch('/approval/parking-lot-request', {
        method: 'POST',
        accessToken,
                body: JSON.stringify({
          type: 'PARKING_LOT_ACCESS',
          requestedParkingLotId: parkingLotId,
          note: reason.trim() || null,
        }),
      });

      setMessage('주차장 접근 권한 신청이 접수되었습니다.');
      setParkingLotId('');
      setReason('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '주차장 접근 권한 신청에 실패했습니다.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          주차장 접근 권한 신청
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          기존 주차장을 선택해 Manager 접근 권한을 신청합니다. 신규 주차장 생성은
          시설 관리 메뉴에서 진행하세요.
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

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <form className="space-y-5" onSubmit={submitRequest}>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              접근 권한 신청
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              시도, 시군구, 주차장 순서로 필터링해서 신청할 주차장을 선택하세요.
            </p>
          </div>

          <ParkingLotRegionFilter
            parkingLotId={parkingLotId}
            onChange={(next) => setParkingLotId(next.parkingLotId)}
          />

          <label className="block">
            <span className="text-sm font-bold text-slate-700">신청 사유</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
              placeholder="예: 해당 주차장의 운영 관리를 담당하게 되어 접근 권한을 신청합니다."
            />
          </label>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving || !parkingLotId}
              className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? '신청 중...' : '접근 권한 신청'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-800">
        신규 주차장 생성은{' '}
        <a
          href="/manager/facilities/lots"
          className="font-black underline underline-offset-4"
        >
          주차장 관리
        </a>
        에서 진행하세요.
      </section>
    </main>
  );
}
