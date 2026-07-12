'use client';

import { useEffect, useMemo, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3000/api';

type QrSpace = {
  id: string;
  code: string;
  number?: string | null;
  status: string;
  priority: boolean;
  activeSessionId?: string | null;
  entryTime?: string | null;
};

type QrSection = {
  id: string;
  name: string;
  code?: string | null;
  spaces: QrSpace[];
};

type QrResponse = {
  qrToken: string;
  parkingLot: {
    id: string;
    name: string;
    code: string;
    address?: string | null;
    region?: string | null;
    sido?: string | null;
    sigungu?: string | null;
    district?: string | null;
    graceMinutes?: number | null;
    photos?: Array<{ id: string; imageUrl: string; isPrimary?: boolean }>;
  };
  sections: QrSection[];
};

type Props = {
  qrToken: string;
};

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('kosmos.accessToken') ?? '';
}

function spaceLabel(space: QrSpace) {
  if (space.status === 'OCCUPIED_UNREGISTERED') return '입차됨 · 미등록';
  if (space.status === 'OCCUPIED') return '입차됨';
  if (space.status === 'EMPTY') return '빈 주차면';
  if (space.status === 'DISABLED') return '사용 불가';
  if (space.status === 'UNKNOWN') return '상태 미확인';
  return space.status;
}

function spaceClass(space: QrSpace, selected: boolean) {
  const base =
    'rounded-2xl border p-4 text-left shadow-sm transition active:scale-[0.99]';
  if (selected) return `${base} border-blue-600 bg-blue-50 ring-2 ring-blue-200`;
  if (space.status === 'OCCUPIED_UNREGISTERED') return `${base} border-emerald-500 bg-emerald-50`;
  if (space.status === 'EMPTY') return `${base} border-slate-200 bg-white`;
  if (space.status === 'OCCUPIED') return `${base} border-red-200 bg-red-50`;
  return `${base} border-slate-200 bg-slate-100 text-slate-500`;
}

export default function MobileQrPage({ qrToken }: Props) {
  const [data, setData] = useState<QrResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedSpace, setSelectedSpace] = useState<QrSpace | null>(null);
  const [mode, setMode] = useState<'member' | 'visitor'>('visitor');
  const [phone, setPhone] = useState('');
  const [vehiclePlateNumber, setVehiclePlateNumber] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_BASE}/mobile/qr/${qrToken}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? 'QR 정보를 불러오지 못했습니다.');

      setData(json);
      setSelectedSectionId(json.sections?.[0]?.id ?? null);

      const firstPriority = json.sections
        ?.flatMap((section: QrSection) => section.spaces)
        ?.find((space: QrSpace) => space.priority);
      setSelectedSpace(firstPriority ?? null);
    } catch (err: any) {
      setMessage(err.message ?? 'QR 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [qrToken]);

  const selectedSection = useMemo(() => {
    if (!data) return null;
    return data.sections.find((section) => section.id === selectedSectionId) ?? data.sections[0] ?? null;
  }, [data, selectedSectionId]);

  async function registerMember() {
    if (!selectedSpace) {
      setMessage('주차면을 먼저 선택하세요.');
      return;
    }

    const token = getToken();
    if (!token) {
      setMessage('회원 등록은 로그인이 필요합니다. 먼저 로그인 후 다시 시도하세요.');
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_BASE}/mobile/qr/${qrToken}/register-member`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ parkingSpaceId: selectedSpace.id }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? '회원 주차 등록에 실패했습니다.');

      setMessage(`등록 완료: ${json.plateNumber ?? selectedSpace.code}`);
      await load();
    } catch (err: any) {
      setMessage(err.message ?? '회원 주차 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  async function registerVisitor() {
    if (!selectedSpace) {
      setMessage('주차면을 먼저 선택하세요.');
      return;
    }

    if (!phone.trim()) {
      setMessage('휴대폰 번호를 입력하세요.');
      return;
    }

    if (!vehiclePlateNumber.trim()) {
      setMessage('차량번호를 입력하세요.');
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_BASE}/mobile/qr/${qrToken}/register-visitor`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          parkingSpaceId: selectedSpace.id,
          phone,
          vehiclePlateNumber,
          verificationToken: 'mobile-web-test',
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? '방문객 주차 등록에 실패했습니다.');

      setMessage(`등록 완료: ${json.plateNumber ?? vehiclePlateNumber}`);
      await load();
    } catch (err: any) {
      setMessage(err.message ?? '방문객 주차 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm">
          QR 정보를 불러오는 중입니다...
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6">
        <div className="mx-auto max-w-md rounded-3xl bg-white p-6 shadow-sm">
          <p className="font-semibold">QR 정보를 찾을 수 없습니다.</p>
          {message && <p className="mt-2 text-sm text-red-600">{message}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-32">
      <section className="bg-slate-950 px-4 pb-6 pt-8 text-white">
        <div className="mx-auto max-w-md">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">KOSMOS PARKING</p>
          <h1 className="mt-3 text-2xl font-bold">{data.parkingLot.name}</h1>
          <p className="mt-2 text-sm text-slate-300">{data.parkingLot.address}</p>
          <div className="mt-4 rounded-2xl bg-white/10 p-4 text-sm">
            <p>Grace Time: {data.parkingLot.graceMinutes ?? 10}분</p>
            <p className="mt-1 text-slate-300">주차면을 먼저 선택한 후 등록을 진행하세요.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-md px-4 py-5">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {data.sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setSelectedSectionId(section.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${
                selectedSectionId === section.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-700 shadow-sm'
              }`}
            >
              {section.name}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {selectedSection?.spaces.map((space) => {
            const selected = selectedSpace?.id === space.id;
            return (
              <button
                key={space.id}
                onClick={() => setSelectedSpace(space)}
                className={spaceClass(space, selected)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-bold">{space.number ?? space.code}</p>
                    <p className="mt-1 text-xs">{spaceLabel(space)}</p>
                  </div>
                  {space.priority && (
                    <span className="rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white">
                      우선
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 rounded-3xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">선택한 주차면</p>
          <p className="mt-1 text-xl font-bold">
            {selectedSpace ? selectedSpace.number ?? selectedSpace.code : '선택 안 됨'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {selectedSpace ? spaceLabel(selectedSpace) : '주차면을 선택하세요.'}
          </p>
        </div>

        <div className="mt-4 rounded-3xl bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
            <button
              onClick={() => setMode('visitor')}
              className={`rounded-xl py-2 text-sm font-semibold ${
                mode === 'visitor' ? 'bg-white shadow-sm' : 'text-slate-500'
              }`}
            >
              방문객
            </button>
            <button
              onClick={() => setMode('member')}
              className={`rounded-xl py-2 text-sm font-semibold ${
                mode === 'member' ? 'bg-white shadow-sm' : 'text-slate-500'
              }`}
            >
              회원
            </button>
          </div>

          {mode === 'visitor' ? (
            <div className="mt-4 space-y-3">
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="휴대폰 번호를 입력하세요. 예: 01012345678"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
              />
              <input
                value={vehiclePlateNumber}
                onChange={(event) => setVehiclePlateNumber(event.target.value)}
                placeholder="차량번호를 입력하세요. 예: 12가3456"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
              />
              <button
                disabled={submitting}
                onClick={registerVisitor}
                className="w-full rounded-2xl bg-blue-600 py-3 font-bold text-white disabled:opacity-50"
              >
                방문객 주차 등록
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <p className="text-sm text-slate-500">
                회원 등록은 로그인된 계정의 기본 차량 정보로 등록됩니다.
              </p>
              <button
                disabled={submitting}
                onClick={registerMember}
                className="w-full rounded-2xl bg-blue-600 py-3 font-bold text-white disabled:opacity-50"
              >
                회원 정보로 주차 등록
              </button>
            </div>
          )}

          {message && (
            <div className="mt-4 rounded-2xl bg-slate-100 p-3 text-sm text-slate-700">
              {message}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
