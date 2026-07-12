'use client';

import { getPublicApiBaseUrl } from '@/lib/public-config';
import { useEffect, useMemo, useState } from 'react';
import { MobileAppShell } from '@/components/mobile/mobile-app-shell';
import { MobileKakaoSpaceMap } from '@/components/mobile/mobile-kakao-space-map';

const API_BASE =
  getPublicApiBaseUrl();

type SpaceOption = {
  id: string;
  code: string;
  status?: string | null;
  type?: string | null;
  lat?: number | null;
  lng?: number | null;
  widthMeter?: number | null;
  heightMeter?: number | null;
  rotationDeg?: number | null;
  section?: {
    id?: string;
    code?: string;
    name?: string | null;
  } | null;
};

type ParkingLotCandidate = {
  id: string;
  name: string;
  code?: string | null;
  region?: string | null;
  district?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  centerLat?: number | null;
  centerLng?: number | null;
  qrToken?: string | null;
};

function getDistanceMeter(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const earthRadiusMeter = 6371000;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const deltaLat = ((b.lat - a.lat) * Math.PI) / 180;
  const deltaLng = ((b.lng - a.lng) * Math.PI) / 180;

  const h =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return 2 * earthRadiusMeter * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function findNearestParkingLot(
  lots: ParkingLotCandidate[],
  currentLocation?: { lat: number; lng: number } | null,
) {
  const candidates = lots.filter(
    (lot) => lot.qrToken && typeof lot.lat === 'number' && typeof lot.lng === 'number',
  );

  if (candidates.length === 0) {
    return lots.find((lot) => lot.qrToken) ?? null;
  }

  if (!currentLocation) return candidates[0];

  return candidates
    .map((lot) => ({
      lot,
      distance: getDistanceMeter(currentLocation, {
        lat: Number(lot.lat),
        lng: Number(lot.lng),
      }),
    }))
    .sort((a, b) => a.distance - b.distance)[0]?.lot ?? candidates[0];
}


function getToken() {
  if (typeof window === 'undefined') return '';

  return (
    localStorage.getItem('kosmos.mobileAccessToken') ??
    localStorage.getItem('kosmos.visitorAccessToken') ??
    ''
  );
}

function getSpaceTypeLabel(type?: string | null) {
  switch (type) {
    case 'REGULAR':
      return '일반';
    case 'COMPACT':
      return '경차';
    case 'EV':
      return '전기차';
    case 'HANDICAPPED':
      return '장애인';
    case 'PREGNANT':
      return '임산부';
    case 'VIP':
      return 'VIP';
    case 'RESERVED':
      return '예약';
    default:
      return type ?? '일반';
  }
}

function isSelectableSpaceType(type?: string | null) {
  return !type || type === 'REGULAR' || type === 'COMPACT';
}

function canRegister(space: SpaceOption) {
  return (
    space.status === 'OCCUPIED_UNREGISTERED' &&
    isSelectableSpaceType(space.type)
  );
}

function getStatusLabel(space: SpaceOption) {
  if (canRegister(space)) return '등록 가능';
  if (space.status === 'EMPTY') return '빈 주차면';
  if (space.status === 'OCCUPIED_UNREGISTERED') return '제한 유형';
  if (space.status === 'OCCUPIED' || space.status === 'OCCUPIED_REGISTERED') {
    return '등록 완료';
  }

  return space.status ?? '상태 미확인';
}

function getCardClass(space: SpaceOption) {
  if (canRegister(space)) return 'border-emerald-200 bg-emerald-50';
  if (space.status === 'EMPTY') return 'border-slate-100 bg-slate-50';
  if (space.status === 'OCCUPIED_UNREGISTERED') return 'border-amber-200 bg-amber-50';
  return 'border-blue-100 bg-blue-50';
}

function getBadgeClass(space: SpaceOption) {
  if (canRegister(space)) return 'bg-emerald-600 text-white';
  if (space.status === 'EMPTY') return 'bg-slate-200 text-slate-600';
  if (space.status === 'OCCUPIED_UNREGISTERED') return 'bg-amber-500 text-white';
  return 'bg-blue-600 text-white';
}

type Props = {
  qrToken?: string;
  defaultViewMode?: 'list' | 'map';
  isHome?: boolean;
};

export default function MobileParkingSpacesPage({
  qrToken: initialQrToken = '',
  defaultViewMode = 'list',
  isHome = false,
}: Props) {

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [spaces, setSpaces] = useState<SpaceOption[]>([]);
  const [lotName, setLotName] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'map'>(defaultViewMode);
  const [qrToken, setQrToken] = useState(initialQrToken);
  const [locationMessage, setLocationMessage] = useState('가까운 주차장을 찾는 중입니다.');

  useEffect(() => {
    if (initialQrToken) {
      setQrToken(initialQrToken);
    }
  }, [initialQrToken]);

  useEffect(() => {
    async function loadNearestParkingLotForHome() {
      if (!isHome || initialQrToken) return;

      setLoading(true);
      setMessage('');

      try {
        const res = await fetch(`${API_BASE}/public/parking-lots`, {
          cache: 'no-store',
        });
        const lotsJson = await res.json();

        if (!res.ok) {
          throw new Error(lotsJson?.message ?? '주차장 목록을 불러오지 못했습니다.');
        }

        const lots: ParkingLotCandidate[] = Array.isArray(lotsJson) ? lotsJson : [];

        const chooseLot = (location: { lat: number; lng: number }) => {
          const nearest = findNearestParkingLot(lots, location);

          if (!nearest?.qrToken) {
            setMessage('현재 위치 주변에 선택 가능한 주차장이 없습니다.');
            setQrToken('');
            setLocationMessage('주차장을 직접 선택해 주세요.');
            return;
          }

          setQrToken(nearest.qrToken);
          setLocationMessage(`현재 위치 기준 가까운 주차장: ${nearest.name}`);
        };

        if (typeof window === 'undefined' || !navigator.geolocation) {
          setQrToken('');
          setSpaces([]);
          setLocationMessage('현재 위치를 확인할 수 없습니다. 주차장을 직접 선택해 주세요.');
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            chooseLot({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          },
          () => {
            setQrToken('');
            setSpaces([]);
            setLocationMessage('위치 권한이 없거나 현재 위치를 확인할 수 없습니다. 주차장을 직접 선택해 주세요.');
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
        );
      } catch (error: any) {
        setMessage(error?.message ?? '가까운 주차장을 찾지 못했습니다.');
        setQrToken('');
      }
    }

    loadNearestParkingLotForHome();
  }, [isHome, initialQrToken]);



  useEffect(() => {
    async function loadSpaces() {
      if (!qrToken) {
        setSpaces([]);
        setLoading(false);

        if (!isHome) {
          setMessage('주차장을 먼저 선택하세요.');
        }

        return;
      }

      setLoading(true);
      setMessage('');

      try {
        const token = getToken();

        const res = await fetch(`${API_BASE}/mobile/qr/${qrToken}`, {
          headers: token ? { authorization: `Bearer ${token}` } : {},
          cache: 'no-store',
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.message ?? '주차면 상태를 불러오지 못했습니다.');
        }

        const lot = data?.parkingLot ?? data?.lot ?? data;
        const sections = Array.isArray(data?.sections)
          ? data.sections
          : Array.isArray(lot?.sections)
            ? lot.sections
            : [];

        const allSpaces = sections.flatMap((section: any) =>
          Array.isArray(section?.spaces)
            ? section.spaces.map((space: any) => ({
                ...space,
                section: {
                  id: section.id,
                  code: section.code,
                  name: section.name,
                },
              }))
            : [],
        );

        setLotName(
          data?.parkingLot?.name ??
            data?.lot?.name ??
            data?.name ??
            lot?.name ??
            '주차장',
        );
        setSpaces(allSpaces);
      } catch (error: any) {
        setMessage(error?.message ?? '주차면 상태를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    }

    loadSpaces();
  }, [qrToken]);

  const mapCenter = useMemo(() => {
    const positioned = spaces.filter(
      (space) => typeof space.lat === 'number' && typeof space.lng === 'number',
    );

    if (positioned.length === 0) {
      return { lat: null, lng: null };
    }

    const lat =
      positioned.reduce((sum, space) => sum + Number(space.lat), 0) /
      positioned.length;
    const lng =
      positioned.reduce((sum, space) => sum + Number(space.lng), 0) /
      positioned.length;

    return { lat, lng };
  }, [spaces]);

  const counts = useMemo(() => {
    return {
      total: spaces.length,
      registerable: spaces.filter((space) => canRegister(space)).length,
      empty: spaces.filter((space) => space.status === 'EMPTY').length,
      occupied: spaces.filter(
        (space) =>
          space.status === 'OCCUPIED' ||
          space.status === 'OCCUPIED_REGISTERED',
      ).length,
      restricted: spaces.filter(
        (space) =>
          space.status === 'OCCUPIED_UNREGISTERED' &&
          !isSelectableSpaceType(space.type),
      ).length,
    };
  }, [spaces]);

  const positionedSpaces = useMemo(() => {
    const candidates = spaces.filter(
      (space) => typeof space.lat === 'number' && typeof space.lng === 'number',
    );

    if (candidates.length === 0) return [];

    const lats = candidates.map((space) => Number(space.lat));
    const lngs = candidates.map((space) => Number(space.lng));

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latRange = Math.max(maxLat - minLat, 0.000001);
    const lngRange = Math.max(maxLng - minLng, 0.000001);

    return candidates.map((space) => {
      const left = 8 + ((Number(space.lng) - minLng) / lngRange) * 84;
      const top = 8 + ((maxLat - Number(space.lat)) / latRange) * 84;

      return {
        ...space,
        mapLeft: left,
        mapTop: top,
      };
    });
  }, [spaces]);

  const hasPositionedMap = positionedSpaces.length > 0;
  const hasKakaoMapSpaces = spaces.some(
    (space) => typeof space.lat === 'number' && typeof space.lng === 'number',
  );

  return (
    <MobileAppShell
      title={isHome ? '주차장 지도' : '전체 주차면 상태'}
      subtitle={
        isHome
          ? '지도에서 주차면 상태를 확인하고 주차 등록을 시작하세요.'
          : '빈 주차면, 등록 가능, 등록 완료 상태를 확인하세요.'
      }
    >
      <section className="rounded-[2rem] bg-white p-5 shadow-2xl">
        {!isHome ? (
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-600">
                PARKING SPACES
              </p>
              <h1 className="mt-2 text-2xl font-black text-slate-950">
                {lotName || '주차면 상태'}
              </h1>
              <p className="mt-2 text-sm font-bold text-slate-500">
                등록은 입차 감지 · 미등록 주차면에서만 가능합니다.
              </p>
            </div>

            <a
              href={
                qrToken
                  ? `/mobile/parking/select?qrToken=${encodeURIComponent(qrToken)}`
                  : '/mobile/parking/select'
              }
              className="shrink-0 rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-700"
            >
              주차 등록
            </a>
          </div>
        ) : null}

        {isHome ? (
          <div className="rounded-3xl bg-blue-50 p-4 text-sm font-bold text-blue-700">
            <p>{locationMessage}</p>

            {!qrToken ? (
              <a
                href="/mobile/parking/select?returnTo=home"
                className="mt-3 block rounded-2xl bg-blue-600 px-4 py-3 text-center text-sm font-black text-white"
              >
                주차장 선택
              </a>
            ) : null}
          </div>
        ) : null}

        <div className={isHome ? 'hidden' : 'mt-5 grid grid-cols-2 gap-2 text-[11px] font-black'}>
          <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-emerald-700 ring-1 ring-emerald-100">
            초록 · 등록 가능 {counts.registerable}
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-2 text-slate-600 ring-1 ring-slate-100">
            회색 · 빈 주차면 {counts.empty}
          </div>
          <div className="rounded-2xl bg-blue-50 px-3 py-2 text-blue-700 ring-1 ring-blue-100">
            파랑 · 등록 완료 {counts.occupied}
          </div>
          <div className="rounded-2xl bg-amber-50 px-3 py-2 text-amber-700 ring-1 ring-amber-100">
            주황 · 제한 유형 {counts.restricted}
          </div>
        </div>

        <div
          data-kosmos-spaces-view-tabs
          className={isHome ? 'hidden' : 'mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 text-xs font-black'}
        >
          {[
            ['list', '목록 보기'],
            ['map', '지도형 보기'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setViewMode(value as 'list' | 'map')}
              className={`rounded-xl px-3 py-2 ${
                viewMode === value
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-5 rounded-3xl bg-slate-50 p-5 text-sm font-bold text-slate-500">
            전체 주차면 상태를 불러오는 중입니다.
          </div>
        ) : null}

        {!loading && message ? (
          <div className="mt-5 rounded-3xl bg-red-50 p-5 text-sm font-bold text-red-600">
            {message}
          </div>
        ) : null}

        {!loading && !message && viewMode === 'list' ? (
          <div className="mt-5 grid grid-cols-3 gap-2">
            {spaces.map((space) => {
              const registerable = canRegister(space);

              const content = (
                <>
                  <span
                    className={`inline-flex rounded-full px-2 py-1 text-[10px] font-black ${getBadgeClass(
                      space,
                    )}`}
                  >
                    {getStatusLabel(space)}
                  </span>
                  <span className="mt-2 block text-sm font-black text-slate-950">
                    {space.section?.code ? `${space.section.code}-` : ''}
                    {space.code}
                  </span>
                  <span className="mt-1 block text-[10px] font-bold text-slate-500">
                    {getSpaceTypeLabel(space.type)}
                  </span>
                </>
              );

              if (registerable) {
                return (
                  <a
                    key={space.id}
                    href={`/mobile/parking/select?qrToken=${encodeURIComponent(
                      qrToken,
                    )}&space=${encodeURIComponent(space.code)}`}
                    className={`rounded-2xl border px-2 py-3 text-left transition ${getCardClass(
                      space,
                    )}`}
                  >
                    {content}
                  </a>
                );
              }

              return (
                <div
                  key={space.id}
                  className={`rounded-2xl border px-2 py-3 text-left opacity-80 ${getCardClass(
                    space,
                  )}`}
                >
                  {content}
                </div>
              );
            })}
          </div>
        ) : null}
        {!loading && !message && viewMode === 'map' && (!isHome || !!qrToken) ? (
          <div
            data-kosmos-mobile-map-fallback
            className="mt-5 rounded-3xl bg-slate-900 p-4"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black text-slate-300">
                  주차장 지도
                </p>
                <p className="mt-1 text-xs font-bold text-slate-400">
                  ＋ 아이콘이 있는 주차면만 주차 등록할 수 있습니다.
                </p>
              </div>
              <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-black text-white">
                {spaces.length}면
              </span>
            </div>

            {hasKakaoMapSpaces ? (
              <div data-kosmos-mobile-kakao-map-wrapper className="mt-4">
                <MobileKakaoSpaceMap
                  spaces={spaces}
                  qrToken={qrToken}
                  center={mapCenter}
                />
              </div>
            ) : null}

            {!hasKakaoMapSpaces && hasPositionedMap ? (
              <div className="relative h-[420px] overflow-hidden rounded-3xl bg-slate-800">
                <div className="absolute inset-4 rounded-[2rem] border border-white/10 bg-slate-950/40" />

                {positionedSpaces.map((space: any) => {
                  const registerable = canRegister(space);

                  const className = [
                    'absolute flex h-14 w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-2xl text-center text-[10px] font-black shadow-lg transition',
                    registerable
                      ? 'bg-emerald-400 text-emerald-950 ring-2 ring-white/50'
                      : space.status === 'EMPTY'
                        ? 'bg-slate-700 text-slate-300 opacity-60'
                        : space.status === 'OCCUPIED_UNREGISTERED'
                          ? 'bg-amber-500 text-amber-950 opacity-80'
                          : 'bg-blue-900 text-blue-100 opacity-75',
                  ].join(' ');

                  const style = {
                    left: `${space.mapLeft}%`,
                    top: `${space.mapTop}%`,
                    transform: `translate(-50%, -50%) rotate(${space.rotationDeg ?? 0}deg)`,
                  };

                  const content = (
                    <>
                      {registerable ? (
                        <span className="mb-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-black text-emerald-700">
                          ＋
                        </span>
                      ) : null}
                      <span className="leading-none">{space.code}</span>
                    </>
                  );

                  if (registerable) {
                    return (
                      <a
                        key={space.id}
                        href={`/mobile/parking/select?qrToken=${encodeURIComponent(
                          qrToken,
                        )}&space=${encodeURIComponent(space.code)}`}
                        className={className}
                        style={style}
                      >
                        {content}
                      </a>
                    );
                  }

                  return (
                    <div key={space.id} className={className} style={style}>
                      {content}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {!hasKakaoMapSpaces && !hasPositionedMap ? (
              <div className="grid grid-cols-5 gap-2">
                {spaces.map((space) => {
                  const registerable = canRegister(space);

                  const className = [
                    'rounded-xl px-2 py-3 text-center text-xs transition',
                    registerable
                      ? 'bg-emerald-400 text-emerald-950 ring-2 ring-white/40'
                      : space.status === 'EMPTY'
                        ? 'bg-slate-800 text-slate-400'
                        : space.status === 'OCCUPIED_UNREGISTERED'
                          ? 'bg-amber-500/80 text-amber-950'
                          : 'bg-blue-900/80 text-blue-100',
                  ].join(' ');

                  const content = (
                    <>
                      {registerable ? (
                        <span className="mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm font-black text-emerald-700 shadow-sm">
                          ＋
                        </span>
                      ) : null}

                      <span className="block truncate text-[11px] font-black">
                        {space.code}
                      </span>

                      {registerable ? (
                        <span className="mt-1 block text-[9px] font-black">
                          주차 등록
                        </span>
                      ) : (
                        <span className="mt-1 block text-[9px] font-bold opacity-70">
                          {space.status === 'EMPTY'
                            ? '빈 주차면'
                            : space.status === 'OCCUPIED_UNREGISTERED'
                              ? '등록 제한'
                              : '사용 중'}
                        </span>
                      )}
                    </>
                  );

                  if (registerable) {
                    return (
                      <a
                        key={space.id}
                        href={`/mobile/parking/select?qrToken=${encodeURIComponent(
                          qrToken,
                        )}&space=${encodeURIComponent(space.code)}`}
                        className={className}
                      >
                        {content}
                      </a>
                    );
                  }

                  return (
                    <div key={space.id} className={`${className} opacity-75`}>
                      {content}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

      </section>
    </MobileAppShell>
  );
}
