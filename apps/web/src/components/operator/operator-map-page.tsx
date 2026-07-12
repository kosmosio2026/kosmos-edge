'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';
import { OperatorKakaoMap } from '@/components/maps/operator-kakao-map';
import type { ParkingLotMapItem, ParkingSpaceMapItem } from '@/types/operator';

type SpaceTypeStyle = {
  type: string;
  label: string;
  strokeColor: string;
  fillColor: string;
  textColor: string;
  iconKey?: string | null;
  iconUrl?: string | null;
};

type LiveSpace = {
  id?: string;
  parkingSpaceId?: string;
  parkingLotId?: string;
  parkingLotName?: string;
  sectionId?: string;
  sectionCode?: string;
  sectionName?: string | null;
  spaceId?: string;
  spaceCode?: string;
  spaceNumber?: string | null;
  code?: string;
  type?: string | null;
  lat?: number | null;
  lng?: number | null;
  widthMeter?: number | null;
  heightMeter?: number | null;
  rotationDeg?: number | null;
  state?: string;
  sensorStatus?: string | null;
  activeSession?: {
    vehiclePlate?: string | null;
    entryTime?: string | null;
    accruedAmount?: number | null;
  } | null;
};

type LiveResponse = {
  ok?: boolean;
  generatedAt?: string;
  spaces?: LiveSpace[];
};

type Props = {
  role?: 'admin' | 'manager' | 'operator' | string;
  title?: string;
  description?: string;
};

function getSpaceId(space: LiveSpace) {
  return space.parkingSpaceId ?? space.spaceId ?? space.id ?? space.spaceCode ?? '';
}

function getSpaceCode(space: LiveSpace) {
  return space.spaceCode ?? space.code ?? space.spaceNumber ?? '-';
}

function getStateLabel(state?: string) {
  switch (state) {
    case 'EMPTY':
      return '빈면';
    case 'OCCUPIED':
      return '주차중';
    case 'REGISTERED':
      return '등록';
    case 'UNREGISTERED_OVERDUE':
      return '미등록 초과';
    case 'PAYMENT_GRACE_EXPIRED':
      return '출차 유예 초과';
    case 'LONG_PARKING_ALERT':
      return '장기 주차';
    case 'SENSOR_ERROR':
      return '센서 오류';
    case 'DISABLED':
      return '비활성';
    default:
      return state ?? '-';
  }
}

function getStateClass(state?: string) {
  switch (state) {
    case 'EMPTY':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    case 'OCCUPIED':
    case 'REGISTERED':
      return 'border-blue-200 bg-blue-50 text-blue-800';
    case 'UNREGISTERED_OVERDUE':
    case 'PAYMENT_GRACE_EXPIRED':
    case 'LONG_PARKING_ALERT':
      return 'border-red-200 bg-red-50 text-red-800';
    case 'SENSOR_ERROR':
      return 'border-amber-200 bg-amber-50 text-amber-800';
    case 'DISABLED':
      return 'border-slate-200 bg-slate-100 text-slate-500';
    default:
      return 'border-slate-200 bg-white text-slate-700';
  }
}

function toOccupancyState(state?: string) {
  switch (state) {
    case 'EMPTY':
      return 'EMPTY';
    case 'OCCUPIED_REGISTERED':
    case 'REGISTERED':
      return 'OCCUPIED_REGISTERED';
    case 'OCCUPIED_UNREGISTERED':
    case 'UNREGISTERED_OVERDUE':
      return 'OCCUPIED_UNREGISTERED';
    case 'PAYMENT_GRACE_EXPIRED':
    case 'LONG_PARKING_ALERT':
    case 'EXITED_UNPAID':
    case 'SENSOR_ERROR':
      return 'VIOLATION';
    default:
      return state ?? 'UNKNOWN';
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR');
}

export function OperatorMapPage({
  title = '담당 구역 맵',
  description = '승인받은 주차 구역의 주차면만 표시됩니다.',
}: Props) {
  const { session } = useAuth();

  const [spaces, setSpaces] = useState<LiveSpace[]>([]);
  const [typeStyles, setTypeStyles] = useState<SpaceTypeStyle[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sectionFilter, setSectionFilter] = useState('');
  const [selectedMapSpace, setSelectedMapSpace] = useState<ParkingSpaceMapItem | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setMessage('');

    try {
      const [data, styleData] = await Promise.all([
        apiFetch<LiveResponse>('/parking-monitor/spaces/live', {
          accessToken: session.accessToken,
        }),
        apiFetch('/parking/maps/space-type-styles', {
          accessToken: session.accessToken,
        }),
      ]);

      setSpaces(Array.isArray(data?.spaces) ? data.spaces : []);
      setTypeStyles(Array.isArray((styleData as any)?.items) ? (styleData as any).items : []);
      setGeneratedAt(data?.generatedAt ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '운영자 맵을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const sections = useMemo(() => {
    const map = new Map<string, string>();

    for (const space of spaces) {
      if (!space.sectionId) continue;
      map.set(
        space.sectionId,
        `${space.parkingLotName ?? '-'} / ${space.sectionCode ?? space.sectionName ?? '-'}`,
      );
    }

    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [spaces]);

  const filteredSpaces = useMemo(() => {
    if (!sectionFilter) return spaces;
    return spaces.filter((space) => space.sectionId === sectionFilter);
  }, [spaces, sectionFilter]);

  const summary = useMemo(() => {
    const lotIds = new Set<string>();
    const sectionIds = new Set<string>();

    for (const space of spaces) {
      if (space.parkingLotId) lotIds.add(space.parkingLotId);
      if (space.sectionId) sectionIds.add(space.sectionId);
    }

    return {
      lots: lotIds.size,
      sections: sectionIds.size,
      spaces: spaces.length,
    };
  }, [spaces]);


  const mapParkingLots = useMemo<ParkingLotMapItem[]>(() => {
    const map = new Map<string, ParkingLotMapItem>();

    for (const space of spaces) {
      if (!space.parkingLotId) continue;

      const existing = map.get(space.parkingLotId);
      const isOccupied = space.state !== 'EMPTY';

      if (!existing) {
        map.set(space.parkingLotId, {
          id: space.parkingLotId,
          name: space.parkingLotName ?? '-',
          code: space.parkingLotName ?? '-',
          lat: space.lat ?? null,
          lng: space.lng ?? null,
          summary: {
            totalSpaces: 1,
            availableSpaces: space.state === 'EMPTY' ? 1 : 0,
            occupiedSpaces: isOccupied ? 1 : 0,
            activeSessions: space.activeSession ? 1 : 0,
          },
          operation: {
            status: 'ACTIVE',
            openFaultCount: space.state === 'SENSOR_ERROR' ? 1 : 0,
          },
        });
      } else {
        existing.summary.totalSpaces += 1;
        if (space.state === 'EMPTY') existing.summary.availableSpaces += 1;
        if (isOccupied) existing.summary.occupiedSpaces += 1;
        if (space.activeSession) existing.summary.activeSessions += 1;
        if (space.state === 'SENSOR_ERROR') existing.operation.openFaultCount += 1;

        if (existing.lat == null && space.lat != null) existing.lat = space.lat;
        if (existing.lng == null && space.lng != null) existing.lng = space.lng;
      }
    }

    return Array.from(map.values());
  }, [spaces]);

  const mapSpaces = useMemo<ParkingSpaceMapItem[]>(() => {
    return filteredSpaces
      .filter((space) => space.lat != null && space.lng != null)
      .map((space) => ({
        id: getSpaceId(space),
        code: getSpaceCode(space),
        type: space.type ?? 'REGULAR',
        status: space.state ?? 'UNKNOWN',
        occupancyState: toOccupancyState(space.state),
        lotId: space.parkingLotId ?? '',
        lotName: space.parkingLotName ?? '-',
        sectionId: space.sectionId ?? '',
        sectionName: space.sectionCode ?? space.sectionName ?? '-',
        lat: space.lat ?? null,
        lng: space.lng ?? null,
        widthMeter: space.widthMeter ?? 2.5,
        heightMeter: space.heightMeter ?? 5,
        rotationDeg: space.rotationDeg ?? 0,
        labelVisible: true,
        isMyRecentSpace: false,
        activeSession: space.activeSession ?? null,
      }));
  }, [filteredSpaces]);

  return (
    <main className="flex flex-col gap-6 p-6 w-full max-w-none">
      <section className="w-full max-w-none rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">Operator Map</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{title}</h1>
            <p className="mt-2 text-sm text-slate-500">{description}</p>
            {generatedAt ? (
              <p className="mt-1 text-xs text-slate-400">
                갱신: {formatDateTime(generatedAt)}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 md:flex-row">
            <select
              value={sectionFilter}
              onChange={(event) => setSectionFilter(event.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">전체 담당 구역</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || !session?.accessToken}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? '불러오는 중...' : '새로고침'}
            </button>
          </div>
        </div>

        {message ? (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </p>
        ) : null}
      </section>

      <section className="w-full max-w-none rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">Live Parking Map</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">지도 보기</h2>
            <p className="mt-1 text-sm text-slate-500">
              위치가 저장된 주차면만 지도 위에 표시됩니다.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
            표시 주차면 {mapSpaces.length}개
          </div>
        </div>

        {mapSpaces.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
            지도 좌표가 저장된 담당 주차면이 없습니다.
          </div>
        ) : (
          <OperatorKakaoMap
            parkingLots={mapParkingLots}
            spaces={mapSpaces}
            selectedLotId={sectionFilter ? mapSpaces[0]?.lotId : mapParkingLots[0]?.id}
            typeStyles={typeStyles}
            onLotClick={() => undefined}
            onSpaceClick={(space) => setSelectedMapSpace(space)}
          />
        )}

        {selectedMapSpace ? (
          <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="font-black text-slate-950">
                  선택 주차면: {selectedMapSpace.code}
                </div>
                <div className="mt-1 text-slate-500">
                  {selectedMapSpace.lotName} / {selectedMapSpace.sectionName}
                </div>
                <div className="mt-1 text-slate-500">
                  상태: {selectedMapSpace.status}
                </div>
              </div>

              <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
                <div className="text-xs font-black text-slate-400">현재 요금</div>
                <div className="mt-1 text-xl font-black text-slate-950">
                  {selectedMapSpace.activeSession?.accruedFeeAmount != null
                    ? `${Number(selectedMapSpace.activeSession.accruedFeeAmount).toLocaleString()}원`
                    : '-'}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-white p-3">
                <div className="text-xs font-black text-slate-400">차량번호</div>
                <div className="mt-1 font-black text-slate-900">
                  {(selectedMapSpace.activeSession as any)?.plateNumber ?? (selectedMapSpace.activeSession as any)?.vehiclePlate ?? '-'}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-xs font-black text-slate-400">입차시간</div>
                <div className="mt-1 font-black text-slate-900">
                  {selectedMapSpace.activeSession?.entryTime
                    ? new Date(selectedMapSpace.activeSession.entryTime).toLocaleString('ko-KR')
                    : '-'}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-xs font-black text-slate-400">등록 상태</div>
                <div className="mt-1 font-black text-slate-900">
                  {selectedMapSpace.activeSession
                    ? selectedMapSpace.activeSession.isRegistered
                      ? '등록 완료'
                      : '등록 필요'
                    : '-'}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-xs font-black text-slate-400">결제 상태</div>
                <div className="mt-1 font-black text-slate-900">
                  {selectedMapSpace.activeSession?.paymentStatus ?? '-'}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-3">
              <Link
                href={`/operator/parking/sessions?space=${encodeURIComponent(selectedMapSpace.code)}&action=detail`}
                className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white"
              >
                상세 보기
              </Link>
              <Link
                href={`/operator/parking/sessions?space=${encodeURIComponent(selectedMapSpace.code)}&action=register`}
                className="rounded-2xl bg-blue-600 px-4 py-3 text-center text-sm font-black text-white"
              >
                주차 등록
              </Link>
              <Link
                href={`/operator/parking/sessions?space=${encodeURIComponent(selectedMapSpace.code)}&action=payment`}
                className="rounded-2xl bg-amber-500 px-4 py-3 text-center text-sm font-black text-white"
              >
                결제 등록
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid w-full max-w-none gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">담당 주차장</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{summary.lots}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">담당 구역</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{summary.sections}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">담당 주차면</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{summary.spaces}</p>
        </div>
      </section>

      <section className="w-full max-w-none rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {filteredSpaces.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
              표시할 담당 주차면이 없습니다.
            </div>
          ) : (
            filteredSpaces.map((space, index) => (
              <div
                key={getSpaceId(space) || index}
                className={`rounded-2xl border p-4 shadow-sm ${getStateClass(space.state)}`}
              >
                <p className="text-xs font-medium opacity-80">
                  {space.parkingLotName ?? '-'} / {space.sectionCode ?? space.sectionName ?? '-'}
                </p>
                <p className="mt-2 text-xl font-bold">{getSpaceCode(space)}</p>
                <p className="mt-2 text-xs font-semibold">{getStateLabel(space.state)}</p>
                <p className="mt-2 text-xs opacity-80">
                  주차면 유형: {space.type ?? '-'}
                </p>
                <p className="mt-3 text-xs opacity-80">
                  차량: {(space.activeSession as any)?.plateNumber ?? (space.activeSession as any)?.vehiclePlate ?? '-'}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

export default OperatorMapPage;
