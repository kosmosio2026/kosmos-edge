'use client';

import { useEffect, useState } from 'react';
import { MobileAppShell } from '@/components/mobile/mobile-app-shell';
import { getPublicApiBaseUrl } from '@/lib/public-config';

const API_BASE_URL = getPublicApiBaseUrl();

function formatPhone(value?: string | null) {
  const digits = String(value ?? '').replace(/\D/g, '');

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return value || '-';
}

function infoValue(...values: unknown[]) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value);
    }
  }

  return '-';
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-b-0">
      <span className="text-sm font-bold text-slate-400">{label}</span>
      <span className="text-right text-sm font-black text-slate-900">{value}</span>
    </div>
  );
}

export default function MobileMemberProfilePage() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [user, setUser] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);

  async function loadProfile() {
    const token = localStorage.getItem('kosmos.mobileAccessToken');

    if (!token) {
      window.location.href = '/mobile/member/login?next=/mobile/member/profile';
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const [profileRes, vehiclesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/mobile/member/me`, {
          headers: {
            authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        }),
        fetch(`${API_BASE_URL}/mobile/member/vehicles`, {
          headers: {
            authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        }),
      ]);

      const profileJson = await profileRes.json().catch(() => null);
      const vehiclesJson = await vehiclesRes.json().catch(() => null);

      if (!profileRes.ok) {
        throw new Error(profileJson?.message ?? '회원 정보를 불러오지 못했습니다.');
      }

      if (!vehiclesRes.ok) {
        throw new Error(vehiclesJson?.message ?? '차량 정보를 불러오지 못했습니다.');
      }

      const nextUser = profileJson?.user ?? profileJson?.member ?? profileJson ?? null;
      const nextVehicles = Array.isArray(vehiclesJson)
        ? vehiclesJson
        : Array.isArray(vehiclesJson?.items)
          ? vehiclesJson.items
          : Array.isArray(vehiclesJson?.vehicles)
            ? vehiclesJson.vehicles
            : [];

      setUser(nextUser);
      setVehicles(nextVehicles);
      localStorage.setItem('kosmos.mobileUser', JSON.stringify(nextUser));
    } catch (error: any) {
      setMessage(error?.message ?? '내 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProfile();
  }, []);

  return (
    <MobileAppShell
      title="내 정보"
      subtitle="회원 정보와 등록 차량을 확인합니다."
      sessionType="member"
    >
      <div className="mx-auto max-w-md">
        <section className="rounded-[2rem] bg-white p-5 shadow-2xl">
          {loading ? (
            <div className="rounded-3xl bg-slate-50 p-5 text-sm font-bold text-slate-500">
              회원 정보를 불러오는 중입니다.
            </div>
          ) : null}

          {!loading && message ? (
            <div className="rounded-3xl bg-red-50 p-5 text-sm font-bold text-red-600">
              {message}
            </div>
          ) : null}

          {!loading && user ? (
            <>
              <div className="rounded-3xl bg-slate-950 p-5 text-white">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-300">
                  Member Profile
                </p>
                <h1 className="mt-2 text-2xl font-black">
                  {infoValue(user.name, user.memberName, user.email, user.phone)}
                </h1>
                <p className="mt-2 text-sm font-bold text-slate-300">
                  KOSMOS 주차관제 서비스 회원 계정
                </p>
              </div>

              <div className="mt-5 rounded-3xl bg-slate-50 p-4">
                <InfoRow label="이름" value={infoValue(user.name, user.memberName)} />
                <InfoRow label="이메일" value={infoValue(user.email)} />
                <InfoRow label="휴대폰" value={formatPhone(infoValue(user.phone, user.phoneNumber, user.mobilePhone))} />
                <InfoRow label="회원 상태" value={infoValue(user.status, '정상')} />
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-slate-950">등록 차량</h2>
                <a
                  href="/mobile/member/vehicles"
                  className="rounded-2xl bg-slate-950 px-4 py-2 text-xs font-black text-white"
                >
                  차량 관리
                </a>
              </div>

              {vehicles.length === 0 ? (
                <div className="mt-3 rounded-3xl bg-slate-50 p-5 text-sm font-bold text-slate-500">
                  등록된 차량이 없습니다.
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  {vehicles.map((vehicle, index) => (
                    <div
                      key={vehicle.id ?? vehicle.vehicleId ?? index}
                      className="rounded-3xl border border-slate-100 bg-slate-50 p-4"
                    >
                      <div className="text-base font-black text-slate-950">
                        {infoValue(vehicle.plateNumber, vehicle.vehiclePlateNumber, vehicle.plate)}
                      </div>
                      <div className="mt-1 text-xs font-bold text-slate-400">
                        {infoValue(vehicle.name, vehicle.vehicleName, vehicle.model, '등록 차량')}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => void loadProfile()}
                className="mt-5 w-full rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white"
              >
                내 정보 새로고침
              </button>
            </>
          ) : null}
        </section>
      </div>
    </MobileAppShell>
  );
}
