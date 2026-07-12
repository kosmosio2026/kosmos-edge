'use client';

import { useEffect, useMemo, useState } from 'react';
import { API_BASE, apiFetch } from './watcher-utils';

type Region = {
  region?: string;
  districts?: string[];
  sido?: string;
  sigungu?: string[];
};

type WatcherApplication = {
  id: string;
  parkingLotId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  requestedAt?: string;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectedReason?: string | null;
};

function statusLabel(status?: string) {
  if (status === 'APPROVED') return '승인됨';
  if (status === 'PENDING') return '승인 대기';
  if (status === 'REJECTED') return '거절됨 · 재신청 가능';
  return '신청 가능';
}

function statusClass(status?: string) {
  if (status === 'APPROVED') return 'bg-emerald-100 text-emerald-700';
  if (status === 'PENDING') return 'bg-amber-100 text-amber-700';
  if (status === 'REJECTED') return 'bg-red-100 text-red-700';
  return 'bg-slate-100 text-slate-600';
}

export default function WatcherApplyPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [lots, setLots] = useState<any[]>([]);
  const [applications, setApplications] = useState<WatcherApplication[]>([]);
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [parkingLotId, setParkingLotId] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const districtOptions = useMemo(() => {
    const found = regions.find((item) => (item.region || item.sido || '') === region);
    return found?.districts ?? found?.sigungu ?? [];
  }, [regions, region]);

  const applicationByLotId = useMemo(() => {
    const map = new Map<string, WatcherApplication>();

    for (const app of applications) {
      const current = map.get(app.parkingLotId);
      if (!current) {
        map.set(app.parkingLotId, app);
        continue;
      }

      const currentTime = current.requestedAt ? new Date(current.requestedAt).getTime() : 0;
      const nextTime = app.requestedAt ? new Date(app.requestedAt).getTime() : 0;
      if (nextTime > currentTime) {
        map.set(app.parkingLotId, app);
      }
    }

    return map;
  }, [applications]);

  const selectedApplication = parkingLotId ? applicationByLotId.get(parkingLotId) : undefined;
  const blocked =
    selectedApplication?.status === 'APPROVED' || selectedApplication?.status === 'PENDING';

  async function loadRegions() {
    const res = await fetch(`${API_BASE}/public/parking-lots/regions`, { cache: 'no-store' });
    const json = await res.json();
    setRegions(json);
    if (json[0]) {
      const firstRegion = json[0].region || json[0].sido || '';
      const firstDistrict = json[0].districts?.[0] ?? json[0].sigungu?.[0] ?? '';
      setRegion(firstRegion);
      setDistrict(firstDistrict);
    }
  }

  async function loadLots() {
    if (!region) return;
    const params = new URLSearchParams();
    params.set('region', region);
    if (district) params.set('district', district);

    const res = await fetch(`${API_BASE}/public/parking-lots?${params.toString()}`, { cache: 'no-store' });
    const json = await res.json();
    setLots(json);
    setParkingLotId(json[0]?.id ?? '');
  }

  async function loadApplications() {
    try {
      const json = await apiFetch('/watcher/applications');
      setApplications(json);
    } catch (err: any) {
      setMessage(err.message ?? '내 Watcher 신청 목록을 불러오지 못했습니다.');
    }
  }

  async function submit() {
    if (!parkingLotId) {
      setMessage('주차장을 선택하세요.');
      return;
    }

    if (blocked) {
      setMessage(
        selectedApplication?.status === 'APPROVED'
          ? '이미 승인된 주차장입니다.'
          : '이미 승인 대기 중인 주차장입니다.',
      );
      return;
    }

    try {
      await apiFetch('/watcher/applications', {
        method: 'POST',
        body: JSON.stringify({ parkingLotId }),
      });

      setMessage('Watcher 신청이 완료되었습니다. Manager 승인을 기다려주세요.');
      await loadApplications();
    } catch (err: any) {
      setMessage(err.message ?? 'Watcher 신청에 실패했습니다.');
    }
  }

  useEffect(() => {
    loadRegions().catch((err) => setMessage(err.message));
    loadApplications();
  }, []);

  useEffect(() => {
    loadLots().catch((err) => setMessage(err.message));
  }, [region, district]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 w-full max-w-none">
      <section className="w-full max-w-none">
        <h1 className="text-2xl font-bold">Watcher 신청</h1>
        <p className="mt-2 text-sm text-slate-500">
          Watcher는 여러 주차장을 담당할 수 있지만, 신청은 한 번에 하나의 주차장만 할 수 있습니다.
        </p>

        <div className="mt-6 space-y-4 rounded-3xl bg-white p-5 shadow-sm">
          <label className="block">
            <span className="text-sm font-semibold">지역</span>
            <select
              value={region}
              onChange={(event) => {
                setRegion(event.target.value);
                setDistrict('');
              }}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
            >
              {regions.map((item) => {
                const value = item.region || item.sido || '';

                return (
                  <option key={value} value={value}>
                    {value}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-semibold">시군구</span>
            <select
              value={district}
              onChange={(event) => setDistrict(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
            >
              {districtOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-semibold">주차장</span>
            <select
              value={parkingLotId}
              onChange={(event) => setParkingLotId(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3"
            >
              {lots.map((lot) => {
                const app = applicationByLotId.get(lot.id);
                return (
                  <option key={lot.id} value={lot.id}>
                    {lot.name} · {statusLabel(app?.status)}
                  </option>
                );
              })}
            </select>
          </label>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold">현재 선택 상태</p>
            <span
              className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusClass(
                selectedApplication?.status,
              )}`}
            >
              {statusLabel(selectedApplication?.status)}
            </span>

            {selectedApplication?.status === 'REJECTED' && selectedApplication.rejectedReason && (
              <p className="mt-2 text-sm text-red-600">
                거절 사유: {selectedApplication.rejectedReason}
              </p>
            )}
          </div>

          <button
            onClick={submit}
            disabled={blocked}
            className="w-full rounded-2xl bg-blue-600 py-3 font-bold text-white disabled:bg-slate-300"
          >
            {selectedApplication?.status === 'APPROVED'
              ? '이미 승인됨'
              : selectedApplication?.status === 'PENDING'
                ? '승인 대기 중'
                : 'Watcher 신청'}
          </button>

          {message && (
            <div className="rounded-2xl bg-slate-100 p-3 text-sm">
              <p>{message}</p>
              {message.includes('로그인') || message.includes('Unauthorized') ? (
                <a href="/watcher" className="mt-2 inline-block font-bold underline">
                  Watcher 로그인/회원가입 화면으로 이동
                </a>
              ) : null}
            </div>
          )}
        </div>

        <div className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="font-bold">내 신청 현황</h2>
          <div className="mt-3 space-y-2">
            {applications.length === 0 ? (
              <p className="text-sm text-slate-500">신청 내역이 없습니다.</p>
            ) : (
              applications.map((app) => (
                <div key={app.id} className="rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{app.parkingLotId}</p>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(app.status)}`}>
                      {statusLabel(app.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    신청일: {app.requestedAt ? new Date(app.requestedAt).toLocaleString() : '-'}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
