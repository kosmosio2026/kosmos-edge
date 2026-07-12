'use client';

import { getPublicApiBaseUrl } from '@/lib/public-config';
import { useEffect, useMemo, useState } from 'react';
import { MobileAppShell } from '@/components/mobile/mobile-app-shell';

const API_BASE =
  getPublicApiBaseUrl();

type Props = {
  returnTo?: string;
};

type RegionItem = {
  region?: string;
  districts?: string[];
  sido?: string;
  sigungu?: string[];
};

type ParkingLotItem = {
  id: string;
  name: string;
  code?: string | null;
  region?: string | null;
  district?: string | null;
  sido?: string | null;
  sigungu?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  centerLat?: number | null;
  centerLng?: number | null;
  qrToken?: string | null;
};


function getParkingLotRegisterHref(qrToken: string, returnTo: string) {
  const params = new URLSearchParams();
  params.set('qrToken', qrToken);

  if (returnTo) {
    params.set('returnTo', returnTo);
  }

  return `/mobile/parking/select?${params.toString()}`;
}

export default function MobileParkingLotPickerPage({ returnTo = '' }: Props) {
  const [regions, setRegions] = useState<RegionItem[]>([]);
  const [parkingLots, setParkingLots] = useState<ParkingLotItem[]>([]);
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [loadingRegions, setLoadingRegions] = useState(true);
  const [loadingLots, setLoadingLots] = useState(false);
  const [message, setMessage] = useState('');

  const districtOptions = useMemo(() => {
    const found = regions.find(
      (item) => (item.region || item.sido || '') === region,
    );

    return found?.districts ?? found?.sigungu ?? [];
  }, [regions, region]);

  useEffect(() => {
    async function loadRegions() {
      setLoadingRegions(true);
      setMessage('');

      try {
        const res = await fetch(`${API_BASE}/public/parking-lots/regions`, {
          cache: 'no-store',
        });
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.message ?? '지역 목록을 불러오지 못했습니다.');
        }

        const nextRegions = Array.isArray(json) ? json : [];
        setRegions(nextRegions);

        if (nextRegions.length > 0) {
          const firstRegion = nextRegions[0].region || nextRegions[0].sido || '';
          const firstDistrict =
            nextRegions[0].districts?.[0] ??
            nextRegions[0].sigungu?.[0] ??
            '';

          setRegion(firstRegion);
          setDistrict(firstDistrict);
        }
      } catch (error: any) {
        setMessage(error?.message ?? '지역 목록을 불러오지 못했습니다.');
      } finally {
        setLoadingRegions(false);
      }
    }

    loadRegions();
  }, []);

  useEffect(() => {
    async function loadParkingLots() {
      if (!region) {
        setParkingLots([]);
        return;
      }

      setLoadingLots(true);
      setMessage('');

      try {
        const params = new URLSearchParams();
        params.set('region', region);
        if (district) params.set('district', district);

        const res = await fetch(
          `${API_BASE}/public/parking-lots?${params.toString()}`,
          { cache: 'no-store' },
        );
        const json = await res.json();

        if (!res.ok) {
          throw new Error(json?.message ?? '주차장 목록을 불러오지 못했습니다.');
        }

        setParkingLots(Array.isArray(json) ? json : []);
      } catch (error: any) {
        setMessage(error?.message ?? '주차장 목록을 불러오지 못했습니다.');
      } finally {
        setLoadingLots(false);
      }
    }

    loadParkingLots();
  }, [region, district]);

  return (
    <MobileAppShell
      title="주차 등록"
      subtitle="지역과 주차장을 선택한 뒤 주차 등록을 진행하세요."
    >
      <section className="rounded-[2rem] bg-white p-5 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">
          PARKING LOT
        </p>

        <h1 className="mt-2 text-2xl font-black text-slate-950">
          주차장 선택
        </h1>

        <p className="mt-2 text-sm font-bold leading-6 text-slate-500">
          지역과 주차장을 선택해서 주차 등록을 진행할 수 있습니다.
        </p>

        <div className="mt-5 grid gap-3">
          <label className="block">
            <span className="text-xs font-bold text-slate-400">시/도</span>
            <select
              value={region}
              disabled={loadingRegions}
              onChange={(event) => {
                const nextRegion = event.target.value;
                const found = regions.find(
                  (item) => (item.region || item.sido || '') === nextRegion,
                );
                const nextDistrict =
                  found?.districts?.[0] ?? found?.sigungu?.[0] ?? '';

                setRegion(nextRegion);
                setDistrict(nextDistrict);
              }}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base font-bold text-slate-900 outline-none focus:border-blue-500"
            >
              {regions.length === 0 ? <option value="">지역 없음</option> : null}

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
            <span className="text-xs font-bold text-slate-400">시/군/구</span>
            <select
              value={district}
              disabled={!region || loadingRegions}
              onChange={(event) => setDistrict(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base font-bold text-slate-900 outline-none focus:border-blue-500"
            >
              <option value="">전체 시/군/구</option>
              {districtOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>

        {message ? (
          <div className="mt-5 rounded-3xl bg-red-50 p-5 text-sm font-bold text-red-600">
            {message}
          </div>
        ) : null}

        {loadingRegions || loadingLots ? (
          <div className="mt-5 rounded-3xl bg-slate-50 p-5 text-sm font-bold text-slate-500">
            주차장 목록을 불러오는 중입니다.
          </div>
        ) : null}

        {!loadingRegions && !loadingLots && !message ? (
          <div className="mt-5 space-y-3">
            {parkingLots.map((lot) => {
              const disabled = !lot.qrToken;

              return (
                <a
                  key={lot.id}
                  href={
                    disabled
                      ? '#'
                      : `/mobile/parking/select?qrToken=${encodeURIComponent(
                          lot.qrToken!,
                        )}`
                  }
                  onClick={(event) => {
                    if (disabled) event.preventDefault();
                  }}
                  className={`block rounded-3xl border p-4 ${
                    disabled
                      ? 'border-slate-100 bg-slate-50 opacity-60'
                      : 'border-blue-100 bg-blue-50 active:scale-[0.99]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black text-slate-950">
                        {lot.name}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {[lot.region || lot.sido, lot.district || lot.sigungu]
                          .filter(Boolean)
                          .join(' · ') || '지역 정보 없음'}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-400">
                        {lot.address ?? lot.code ?? ''}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full bg-white px-3 py-2 text-xs font-black text-blue-700">
                      선택
                    </span>
                  </div>

                  {disabled ? (
                    <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-xs font-bold text-red-500">
                      모바일 등록 토큰이 아직 없는 주차장입니다.
                    </p>
                  ) : (
                    <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-xs font-black text-blue-700">
                      이 주차장에서 주차 등록하기
                    </p>
                  )}
                </a>
              );
            })}

            {parkingLots.length === 0 ? (
              <div className="rounded-3xl bg-amber-50 p-5 text-sm font-bold text-amber-700">
                선택한 지역에 표시할 주차장이 없습니다.
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </MobileAppShell>
  );
}
