'use client';

import { useEffect, useState } from 'react';
import { MobileAppShell } from '@/components/mobile/mobile-app-shell';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3000/api';

type VehicleItem = {
  id: string | null;
  plateNumber: string;
  vehicleType?: string | null;
  ownerName?: string | null;
  isPrimary?: boolean;
  isActive?: boolean;
  createdAt?: string;
};

export default function MobileMemberVehiclesPage() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function loadVehicles() {
      const token = localStorage.getItem('kosmos.mobileAccessToken');

      if (!token) {
        window.location.href = '/mobile/member/login?next=/mobile/member/vehicles';
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/mobile/member/vehicles`, {
          headers: {
            authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.message ?? '등록 차량을 불러오지 못했습니다.');
        }

        setUser(data?.user ?? null);
        setVehicles(Array.isArray(data?.vehicles) ? data.vehicles : []);
      } catch (error: any) {
        setMessage(error?.message ?? '등록 차량을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }

    loadVehicles();
  }, []);

  return (
    <MobileAppShell
      title="내 차량"
      subtitle="회원 차량을 등록하고 대표 차량을 관리하세요."
      sessionType="member"
    >
      <div className="mx-auto max-w-md">
        <section className="rounded-[2rem] bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">
                MEMBER VEHICLES
              </p>
              <h1 className="mt-2 text-2xl font-black text-slate-950">
                내 등록 차량
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                QR 회원 등록 시 아래 차량 중 하나를 선택합니다.
              </p>
            </div>

            <a
              href="/mobile"
              className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600"
            >
              홈
            </a>
          </div>

          {user ? (
            <div className="mt-5 rounded-3xl bg-blue-50 p-4">
              <p className="text-xs font-bold text-blue-500">회원</p>
              <p className="mt-1 text-base font-black text-slate-900">
                {user.name ?? user.phone ?? user.email}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {user.email ?? user.phone}
              </p>
            </div>
          ) : null}

          {loading ? (
            <div className="mt-5 rounded-3xl bg-slate-50 p-5 text-sm font-bold text-slate-500">
              등록 차량을 불러오는 중입니다.
            </div>
          ) : null}

          {!loading && message ? (
            <div className="mt-5 rounded-3xl bg-red-50 p-5 text-sm font-bold text-red-600">
              {message}
            </div>
          ) : null}

          {!loading && !message && vehicles.length === 0 ? (
            <div className="mt-5 rounded-3xl bg-amber-50 p-5">
              <p className="text-sm font-black text-amber-800">
                등록된 차량이 없습니다.
              </p>
              <p className="mt-1 text-sm text-amber-700">
                회원가입 또는 차량 추가 화면에서 차량번호를 등록하세요.
              </p>
            </div>
          ) : null}

          {!loading && vehicles.length > 0 ? (
            <div className="mt-5 space-y-3">
              {vehicles.map((vehicle) => (
                <div
                  key={vehicle.id ?? vehicle.plateNumber}
                  className="rounded-3xl border border-slate-100 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xl font-black tracking-tight text-slate-950">
                        {vehicle.plateNumber}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-400">
                        {vehicle.vehicleType ?? '차종 미입력'}
                        {vehicle.ownerName ? ` · ${vehicle.ownerName}` : ''}
                      </p>
                    </div>

                    {vehicle.isPrimary ? (
                      <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-black text-white">
                        대표
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-6 grid gap-3">
            <a
              href="/mobile"
              className="rounded-2xl bg-slate-900 px-5 py-4 text-center text-base font-black text-white"
            >
              모바일 홈으로
            </a>
          </div>
        </section>
      </div>
    </MobileAppShell>
  );
}
