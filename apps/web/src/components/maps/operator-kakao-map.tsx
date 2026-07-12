'use client';

import { useEffect, useRef } from 'react';
import type { ParkingLotMapItem, ParkingSpaceMapItem } from '@/types/operator';
import { getParkingSpacePolygonPath } from '@/lib/maps/parking-space-geometry';
import {
  getParkingSpaceMapStatus,
  getParkingSpacePolygonStyle,
} from '@/lib/maps/parking-space-map-style';
import { useKakaoMapLoader } from './kakao-map-loader';

declare global {
  interface Window {
    kakao: any;
  }
}

const SPACE_VISUAL_SCALE = 1;
const SPACE_LABEL_FONT_SIZE = 6;

type SpaceTypeStyle = {
  type: string;
  label: string;
  strokeColor: string;
  fillColor: string;
  textColor: string;
  iconKey?: string | null;
  iconUrl?: string | null;
};

function getVisualSpace(space: ParkingSpaceMapItem) {
  return {
    ...space,
    widthMeter:
      typeof (space as any).widthMeter === 'number'
        ? (space as any).widthMeter * SPACE_VISUAL_SCALE
        : (space as any).widthMeter,
    heightMeter:
      typeof (space as any).heightMeter === 'number'
        ? (space as any).heightMeter * SPACE_VISUAL_SCALE
        : (space as any).heightMeter,
  };
}

function rotatedRectanglePath(space: ParkingSpaceMapItem, kakao: any) {
  return getParkingSpacePolygonPath(getVisualSpace(space) as ParkingSpaceMapItem).map(
    (point) => new kakao.maps.LatLng(point.lat, point.lng),
  );
}

function getSpaceStatus(space: ParkingSpaceMapItem) {
  return (
    (space as any).status ??
    (space as any).state ??
    space.occupancyState ??
    ''
  );
}

function getSpaceType(space: ParkingSpaceMapItem) {
  return (space as any).type ?? (space as any).spaceType ?? null;
}

function getSpaceCenter(path: any[], space: ParkingSpaceMapItem, kakao: any) {
  if (space.lat != null && space.lng != null) {
    return new kakao.maps.LatLng(space.lat, space.lng);
  }

  if (!path.length) return null;

  const sum = path.reduce(
    (acc, point) => {
      acc.lat += point.getLat();
      acc.lng += point.getLng();
      return acc;
    },
    { lat: 0, lng: 0 },
  );

  return new kakao.maps.LatLng(sum.lat / path.length, sum.lng / path.length);
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function makeOverlayId(space: ParkingSpaceMapItem) {
  const raw = String(space.id ?? space.code ?? Math.random());
  return `kosmos-map-space-${raw.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function getOverlayContent(space: ParkingSpaceMapItem, registerable: boolean) {
  const code = space.code ?? (space as any).number ?? '-';
  const overlayId = makeOverlayId(space);
  const rotationDeg = Number((space as any).rotationDeg ?? 0);
  const cursor = registerable ? 'pointer' : 'default';
  const color = registerable ? '#064e3b' : '#0f172a';

  return {
    overlayId,
    html: `
      <button
        id="${overlayId}"
        type="button"
        title="${escapeHtml(code)}"
        data-kosmos-registerable="${registerable ? 'true' : 'false'}"
        style="
          display:flex;
          align-items:center;
          justify-content:center;
          width:28px;
          height:12px;
          padding:0;
          border:0;
          background:rgba(255,255,255,0.08);
          color:${color};
          font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
          font-size:${SPACE_LABEL_FONT_SIZE}px;
          line-height:1;
          font-weight:950;
          letter-spacing:-0.04em;
          text-align:center;
          cursor:${cursor};
          user-select:none;
          pointer-events:${registerable ? 'auto' : 'none'};
          transform:translate(-50%, -50%) rotate(${rotationDeg}deg);
          transform-origin:center center;
          text-shadow:
            0 1px 0 rgba(255,255,255,0.95),
            1px 0 0 rgba(255,255,255,0.95),
            -1px 0 0 rgba(255,255,255,0.95),
            0 -1px 0 rgba(255,255,255,0.95);
        "
      >
        ${escapeHtml(code)}
      </button>
    `,
  };
}

export function OperatorKakaoMap({
  parkingLots,
  spaces,
  selectedLotId,
  onLotClick,
  onSpaceClick,
  typeStyles = [],
}: {
  parkingLots: ParkingLotMapItem[];
  spaces: ParkingSpaceMapItem[];
  selectedLotId?: string;
  onLotClick: (lot: ParkingLotMapItem) => void;
  onSpaceClick: (space: ParkingSpaceMapItem) => void;
  typeStyles?: SpaceTypeStyle[];
}) {
  void typeStyles;

  const kakaoLoader = useKakaoMapLoader();
  const ready = kakaoLoader.ready;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const lotMarkersRef = useRef<any[]>([]);
  const spacePolygonsRef = useRef<any[]>([]);
  const overlaysRef = useRef<any[]>([]);
  const infoWindowRef = useRef<any>(null);

  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;

    const kakao = window.kakao;
    const map = new kakao.maps.Map(containerRef.current, {
      center: new kakao.maps.LatLng(37.402005, 127.108621),
      level: 4,
    });

    if (typeof map.setMinLevel === 'function') {
      map.setMinLevel(1);
    }

    mapRef.current = map;
  }, [ready]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;

    const kakao = window.kakao;
    const map = mapRef.current;

    lotMarkersRef.current.forEach((marker) => marker.setMap(null));
    lotMarkersRef.current = [];

    parkingLots.forEach((lot) => {
      if (lot.lat == null || lot.lng == null) return;

      const marker = new kakao.maps.Marker({
        map,
        position: new kakao.maps.LatLng(lot.lat, lot.lng),
        title: lot.name,
        zIndex: 20,
      });

      kakao.maps.event.addListener(marker, 'click', () => {
        if (infoWindowRef.current) {
          infoWindowRef.current.close();
        }

        const buttonId = `kosmos-lot-spaces-${lot.id}`;

        infoWindowRef.current = new kakao.maps.InfoWindow({
          position: new kakao.maps.LatLng(lot.lat!, lot.lng!),
          content: `
            <div style="padding:12px 14px;min-width:230px;font-size:12px;line-height:1.6;">
              <div style="font-weight:800;font-size:14px;margin-bottom:6px;">${escapeHtml(lot.name)}</div>
              <div>운영 상태: ${escapeHtml(lot.operation.status)}</div>
              <div>전체 주차면: ${escapeHtml(lot.summary.totalSpaces)}</div>
              <div>여유 주차면: ${escapeHtml(lot.summary.availableSpaces)}</div>
              <div>사용 중: ${escapeHtml(lot.summary.occupiedSpaces)}</div>
              <button
                id="${buttonId}"
                type="button"
                style="
                  margin-top:10px;
                  width:100%;
                  border:0;
                  border-radius:12px;
                  background:#2563eb;
                  color:white;
                  padding:9px 10px;
                  font-weight:800;
                  cursor:pointer;
                "
              >
                주차면 확대 보기
              </button>
            </div>
          `,
        });

        infoWindowRef.current.open(map, marker);

        window.setTimeout(() => {
          const button = document.getElementById(buttonId);
          if (!button) return;

          button.onclick = () => {
            const centerLat = (lot as any).centerLat ?? lot.lat;
            const centerLng = (lot as any).centerLng ?? lot.lng;

            map.setCenter(new kakao.maps.LatLng(centerLat!, centerLng!));
            map.setLevel(1);

            window.setTimeout(() => {
              map.setCenter(new kakao.maps.LatLng(centerLat!, centerLng!));
              map.setLevel(1);
            }, 120);

            infoWindowRef.current?.close();
            onLotClick(lot);
          };
        }, 0);
      });

      lotMarkersRef.current.push(marker);
    });

    if (!selectedLotId && parkingLots.length > 0) {
      const bounds = new kakao.maps.LatLngBounds();

      parkingLots.forEach((lot) => {
        if (lot.lat != null && lot.lng != null) {
          bounds.extend(new kakao.maps.LatLng(lot.lat, lot.lng));
        }
      });

      if (!bounds.isEmpty()) {
        map.setBounds(bounds);
      }
    }
  }, [ready, parkingLots, selectedLotId, onLotClick]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;

    const kakao = window.kakao;
    const map = mapRef.current;

    spacePolygonsRef.current.forEach((polygon) => polygon.setMap(null));
    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    spacePolygonsRef.current = [];
    overlaysRef.current = [];

    const visibleSpaces = selectedLotId
      ? spaces.filter((space) => space.lotId === selectedLotId)
      : [];

    const bounds = new kakao.maps.LatLngBounds();

    visibleSpaces.forEach((space) => {
      const path = rotatedRectanglePath(space, kakao);
      if (!path.length) return;

      path.forEach((point) => bounds.extend(point));

      const status = getSpaceStatus(space);
      const type = getSpaceType(space);
      const mapStatus = getParkingSpaceMapStatus({
        status,
        type,
      });
      const registerable = mapStatus === 'REGISTERABLE';

      const polygonStyle = getParkingSpacePolygonStyle({
        status,
        type,
        isRegisterable: registerable,
      });

      const polygon = new kakao.maps.Polygon({
        map,
        path,
        strokeWeight: polygonStyle.strokeWeight,
        strokeColor: polygonStyle.strokeColor,
        strokeOpacity: polygonStyle.strokeOpacity,
        fillColor: polygonStyle.fillColor,
        fillOpacity: polygonStyle.fillOpacity,
      });

      if (registerable) {
        kakao.maps.event.addListener(polygon, 'click', () => {
          onSpaceClick(space);
        });
      }

      spacePolygonsRef.current.push(polygon);

      const center = getSpaceCenter(path, space, kakao);

      if (center) {
        const { overlayId, html } = getOverlayContent(space, registerable);

        const overlay = new kakao.maps.CustomOverlay({
          map,
          position: center,
          content: html,
          yAnchor: 0.5,
          xAnchor: 0.5,
          clickable: true,
        });

        overlaysRef.current.push(overlay);

        window.setTimeout(() => {
          const element = document.getElementById(overlayId);
          if (!element) return;

          element.onclick = (event) => {
            event.preventDefault();
            event.stopPropagation();

            if (registerable) {
              onSpaceClick(space);
            }
          };
        }, 0);
      }

      if (space.isMyRecentSpace && center) {
        const flag = new kakao.maps.CustomOverlay({
          map,
          position: center,
          content: `
            <div style="
              transform:translateY(-42px);
              padding:4px 8px;
              font-size:11px;
              font-weight:800;
              color:#1d4ed8;
              background:#dbeafe;
              border:1px solid #60a5fa;
              border-radius:999px;
              white-space:nowrap;
              box-shadow:0 6px 12px rgba(15,23,42,0.14);
            ">MY PARKING</div>
          `,
          yAnchor: 1,
          xAnchor: 0.5,
        });

        overlaysRef.current.push(flag);
      }
    });

    if (selectedLotId && visibleSpaces.length > 0 && !bounds.isEmpty()) {
      const selectedLot = parkingLots.find((lot) => lot.id === selectedLotId);

      const centerLat =
        (selectedLot as any)?.centerLat ??
        selectedLot?.lat ??
        visibleSpaces.find((space) => space.lat != null)?.lat;

      const centerLng =
        (selectedLot as any)?.centerLng ??
        selectedLot?.lng ??
        visibleSpaces.find((space) => space.lng != null)?.lng;

      if (centerLat != null && centerLng != null) {
        map.setCenter(new kakao.maps.LatLng(centerLat, centerLng));
      }

      map.setLevel(1);
    }
  }, [ready, spaces, parkingLots, selectedLotId, onSpaceClick]);

  if (kakaoLoader.error) {
    return (
      <div className="flex h-[620px] flex-col items-center justify-center rounded-3xl bg-slate-100 px-6 text-center">
        <div className="text-sm font-black text-slate-700">
          지도를 불러올 수 없습니다.
        </div>
        <div className="mt-2 text-xs font-bold text-slate-500">
          {kakaoLoader.error}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-[420px] w-full rounded-3xl border md:h-[640px]"
    />
  );
}
