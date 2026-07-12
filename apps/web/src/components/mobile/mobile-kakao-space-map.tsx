'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useKakaoMapLoader } from '@/components/maps/kakao-map-loader';
import { getParkingSpacePolygonPath } from '@/lib/maps/parking-space-geometry';

declare global {
  interface Window {
    kakao: any;
  }
}

type SpaceItem = {
  id: string;
  code: string;
  status?: string | null;
  type?: string | null;
  lat?: number | null;
  lng?: number | null;
  widthMeter?: number | null;
  heightMeter?: number | null;
  rotationDeg?: number | null;
};

type Props = {
  spaces: SpaceItem[];
  qrToken: string;
  center?: {
    lat?: number | null;
    lng?: number | null;
  } | null;
  className?: string;
};

function isSelectableSpaceType(type?: string | null) {
  return !type || type === 'REGULAR' || type === 'COMPACT';
}

function canRegister(space: SpaceItem) {
  return (
    space.status === 'OCCUPIED_UNREGISTERED' &&
    isSelectableSpaceType(space.type)
  );
}

function getSpaceColors(space: SpaceItem) {
  if (canRegister(space)) {
    return {
      fill: '#34d399',
      stroke: '#047857',
      opacity: 0.75,
    };
  }

  if (space.status === 'EMPTY') {
    return {
      fill: '#334155',
      stroke: '#64748b',
      opacity: 0.35,
    };
  }

  if (space.status === 'OCCUPIED_UNREGISTERED') {
    return {
      fill: '#f59e0b',
      stroke: '#b45309',
      opacity: 0.55,
    };
  }

  return {
    fill: '#1e40af',
    stroke: '#1d4ed8',
    opacity: 0.45,
  };
}

export function MobileKakaoSpaceMap({
  spaces,
  qrToken,
  center,
  className,
}: Props) {
  const kakaoLoader = useKakaoMapLoader();
  const ready = kakaoLoader.ready;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const polygonsRef = useRef<any[]>([]);
  const overlaysRef = useRef<any[]>([]);

  const drawableSpaces = useMemo(
    () =>
      spaces.filter(
        (space) =>
          typeof space.lat === 'number' && typeof space.lng === 'number',
      ),
    [spaces],
  );

  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;

    const kakao = window.kakao;

    const firstSpace = drawableSpaces[0];
    const lat =
      typeof center?.lat === 'number'
        ? center.lat
        : typeof firstSpace?.lat === 'number'
          ? firstSpace.lat
          : 37.5665;
    const lng =
      typeof center?.lng === 'number'
        ? center.lng
        : typeof firstSpace?.lng === 'number'
          ? firstSpace.lng
          : 126.978;

    const map = new kakao.maps.Map(containerRef.current, {
      center: new kakao.maps.LatLng(lat, lng),
      level: 2,
    });

    mapRef.current = map;
  }, [ready, center?.lat, center?.lng, drawableSpaces]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;

    const kakao = window.kakao;
    const map = mapRef.current;

    polygonsRef.current.forEach((polygon) => polygon.setMap(null));
    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    polygonsRef.current = [];
    overlaysRef.current = [];

    const bounds = new kakao.maps.LatLngBounds();

    drawableSpaces.forEach((space) => {
      const path = getParkingSpacePolygonPath(space).map(
        (point) => new kakao.maps.LatLng(point.lat, point.lng),
      );

      if (!path.length) return;

      path.forEach((point: any) => bounds.extend(point));

      const colors = getSpaceColors(space);
      const registerable = canRegister(space);

      const polygon = new kakao.maps.Polygon({
        map,
        path,
        strokeWeight: registerable ? 3 : 2,
        strokeColor: colors.stroke,
        strokeOpacity: registerable ? 0.95 : 0.65,
        fillColor: colors.fill,
        fillOpacity: colors.opacity,
        zIndex: registerable ? 20 : 10,
      });

      if (registerable) {
        kakao.maps.event.addListener(polygon, 'click', () => {
          window.location.href = `/mobile/parking/select?qrToken=${encodeURIComponent(
            qrToken,
          )}&space=${encodeURIComponent(space.code)}`;
        });

        if (typeof space.lat === 'number' && typeof space.lng === 'number') {
          const overlay = new kakao.maps.CustomOverlay({
            map,
            position: new kakao.maps.LatLng(space.lat, space.lng),
            content: `
              <div style="
                width:26px;
                height:26px;
                border-radius:999px;
                display:flex;
                align-items:center;
                justify-content:center;
                background:white;
                color:#047857;
                font-size:18px;
                font-weight:900;
                box-shadow:0 4px 12px rgba(15,23,42,.28);
                border:2px solid #34d399;
                cursor:pointer;
              ">＋</div>
            `,
            xAnchor: 0.5,
            yAnchor: 0.5,
            zIndex: 30,
          });

          overlaysRef.current.push(overlay);
        }
      }

      polygonsRef.current.push(polygon);
    });

    if (!bounds.isEmpty()) {
      map.setBounds(bounds);
      window.setTimeout(() => {
        if (map.getLevel() > 2) map.setLevel(2);
      }, 0);
    } else if (
      typeof center?.lat === 'number' &&
      typeof center?.lng === 'number'
    ) {
      map.setCenter(new kakao.maps.LatLng(center.lat, center.lng));
      map.setLevel(2);
    }

    return () => {
      polygonsRef.current.forEach((polygon) => polygon.setMap(null));
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      polygonsRef.current = [];
      overlaysRef.current = [];
    };
  }, [ready, drawableSpaces, qrToken, center?.lat, center?.lng]);

  if (!ready || drawableSpaces.length === 0) {
    return null;
  }

  if (kakaoLoader.error) {
    return (
      <div className="flex h-80 flex-col items-center justify-center rounded-3xl bg-slate-100 px-6 text-center">
        <div className="text-sm font-black text-slate-700">지도를 불러올 수 없습니다.</div>
        <div className="mt-2 text-xs font-bold text-slate-500">{kakaoLoader.error}</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-kosmos-mobile-kakao-map
      className={
        className ??
        'h-[430px] w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-900'
      }
    />
  );
}
