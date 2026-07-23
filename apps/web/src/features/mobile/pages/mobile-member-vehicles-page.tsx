'use client';

import { useEffect, useState } from 'react';
import { MobileAppShell } from '@/components/mobile/mobile-app-shell';
import { getPublicApiBaseUrl } from '@/lib/public-config';

const API_BASE_URL = getPublicApiBaseUrl();

const SIZE_CLASS_LABELS: Record<string, string> = {
  GENERAL: '일반 승용차',
  COMPACT: '경차',
  VAN: '승합차',
  TRUCK: '화물차',
  MOTORCYCLE: '이륜차',
  OTHER: '기타',
};

const POWERTRAIN_LABELS: Record<string, string> = {
  ICE: '내연기관',
  HYBRID: '하이브리드',
  PHEV: '플러그인 하이브리드',
  EV: '전기차',
  HYDROGEN: '수소차',
  OTHER: '기타',
};

type EligibilityDeclaration = {
  eligibilityDefinition?: {
    code?: string;
    name?: string;
  };
};

type VehicleItem = {
  id: string;
  isPrimary: boolean;
  vehicle: {
    id: string;
    plateNumber: string;
    vehicleType?: string | null;
    sizeClass?: string | null;
    powertrainType?: string | null;
    ownerName?: string | null;
    isActive?: boolean;
    eligibilityDeclarations?: EligibilityDeclaration[];
  };
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
        window.location.href =
          '/mobile/member/login?next=/mobile/member/vehicles';
        return;
      }

      try {
        const storedUser = localStorage.getItem('kosmos.mobileUser');
        setUser(storedUser ? JSON.parse(storedUser) : null);

        const res = await fetch(`${API_BASE_URL}/mobile/me/vehicles`, {
          headers: {
            authorization: `Bearer ${token}`,
          },
          cache: 'no-store',
        });

        const data = await res.json();

        if (!res.ok) {
          const errorMessage = Array.isArray(data?.message)
            ? data.message.join(', ')
            : data?.message;
          throw new Error(
            errorMessage ?? '등록 차량을 불러오지 못했습니다.',
          );
        }

        setVehicles(Array.isArray(data) ? data : []);
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
      subtitle="회원 차량과 자기신고 할인 자격을 확인하세요."
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
                실제 할인은 현재 차량과 주차장 할인 프로그램이 일치할 때만
                적용됩니다.
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
                {user.email ?? user.phone ?? ''}
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
              {vehicles.map((item) => {
                const vehicle = item.vehicle;
                const eligibilityNames =
                  vehicle.eligibilityDeclarations
                    ?.map(
                      (entry) =>
                        entry.eligibilityDefinition?.name ??
                        entry.eligibilityDefinition?.code,
                    )
                    .filter(Boolean) ?? [];

                return (
                  <div
                    key={item.id}
                    className="rounded-3xl border border-slate-100 bg-slate-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xl font-black tracking-tight text-slate-950">
                          {vehicle.plateNumber}
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          {SIZE_CLASS_LABELS[vehicle.sizeClass ?? ''] ??
                            vehicle.sizeClass ??
                            vehicle.vehicleType ??
                            '차량 분류 미입력'}
                          {' · '}
                          {POWERTRAIN_LABELS[vehicle.powertrainType ?? ''] ??
                            vehicle.powertrainType ??
                            '동력원 미입력'}
                        </p>
                      </div>

                      {item.isPrimary ? (
                        <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-black text-white">
                          대표
                        </span>
                      ) : null}
                    </div>

                    {eligibilityNames.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {eligibilityNames.map((name) => (
                          <span
                            key={String(name)}
                            className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="mt-5 rounded-3xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
            현재 자격 정보는 회원이 선택한 자기신고 내용입니다. 국가망 또는
            공공 API 검증은 사용하지 않습니다.
          </div>

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
