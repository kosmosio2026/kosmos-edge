'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';
import { useKakaoMapLoader } from '@/components/maps/kakao-map-loader';
import { getParkingSpacePolygonPath } from '@/lib/maps/parking-space-geometry';

declare global {
  interface Window {
    kakao: any;
  }
}

type Role = 'admin' | 'manager' | 'operator';

type Props = {
  role?: Role;
};

type SpaceType = 'REGULAR' | 'EV' | 'HANDICAPPED' | 'PREGNANT' | 'COMPACT' | 'VIP' | 'RESERVED';

type SpaceTypeStyle = {
  id?: string;
  type: string;
  label: string;
  description?: string | null;
  strokeColor: string;
  fillColor: string;
  textColor: string;
  iconKey?: string | null;
  iconUrl?: string | null;
  displayOrder?: number | null;
};

type ParkingSpace = {
  id: string;
  code?: string | null;
  number?: string | null;
  type?: SpaceType | string | null;
  status?: string | null;
  sectionId?: string | null;
  lat?: number | null;
  lng?: number | null;
  widthMeter?: number | null;
  heightMeter?: number | null;
  rotationDeg?: number | null;
  polygonJson?: any;
  sectionName?: string | null;
  parkingLotName?: string | null;
  section?: {
    code?: string | null;
    name?: string | null;
    parkingLot?: {
      name?: string | null;
    } | null;
  } | null;
};

function unwrapList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (value && typeof value === 'object') {
    const obj = value as {
      items?: unknown;
      data?: unknown;
    };

    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];

    if (
      obj.data &&
      typeof obj.data === 'object' &&
      Array.isArray((obj.data as { items?: unknown }).items)
    ) {
      return (obj.data as { items: T[] }).items;
    }
  }

  return [];
}

function meterToLat(meters: number) {
  return meters / 111_111;
}

function meterToLng(meters: number, lat: number) {
  return meters / (111_111 * Math.cos((lat * Math.PI) / 180));
}

function getSpaceCode(space: ParkingSpace) {
  return space.code ?? space.number ?? '-';
}

function getLotName(space: ParkingSpace) {
  return space.section?.parkingLot?.name ?? space.parkingLotName ?? '-';
}

function getSectionName(space: ParkingSpace) {
  return space.section?.code ?? space.section?.name ?? space.sectionName ?? '-';
}

function getSectionId(space: ParkingSpace) {
  return space.sectionId ?? `${getLotName(space)}::${getSectionName(space)}`;
}

const spaceCodeCollator = new Intl.Collator('ko-KR', {
  numeric: true,
  sensitivity: 'base',
});

function compareSpacesByCode(a: ParkingSpace, b: ParkingSpace) {
  const lotCompare = spaceCodeCollator.compare(getLotName(a), getLotName(b));
  if (lotCompare !== 0) return lotCompare;

  const sectionCompare = spaceCodeCollator.compare(getSectionName(a), getSectionName(b));
  if (sectionCompare !== 0) return sectionCompare;

  return spaceCodeCollator.compare(getSpaceCode(a), getSpaceCode(b));
}

function getTypeLabel(type?: string | null) {
  switch (type) {
    case 'REGULAR':
      return '일반';
    case 'HANDICAPPED':
      return '장애인';
    case 'EV':
      return '전기차';
    case 'PREGNANT':
      return '임산부';
    case 'COMPACT':
      return '경차';
    case 'VIP':
      return 'VIP';
    case 'RESERVED':
      return '예약/지정';
    default:
      return type ?? '-';
  }
}

function getStyleForType(styles: SpaceTypeStyle[], type?: string | null) {
  const found = styles.find((style) => style.type === type);
  if (found) return found;

  const colors = typeColors(type);
  return {
    type: type ?? 'REGULAR',
    label: getTypeLabel(type),
    strokeColor: colors.stroke,
    fillColor: colors.fill,
    textColor: '#0F172A',
    iconKey: type?.toLowerCase() ?? null,
    iconUrl: null,
    displayOrder: 100,
  } satisfies SpaceTypeStyle;
}

function typeColors(type?: string | null) {
  switch (type) {
    case 'HANDICAPPED':
      return { fill: '#DBEAFE', stroke: '#2563EB' };
    case 'EV':
      return { fill: '#DCFCE7', stroke: '#16A34A' };
    case 'PREGNANT':
      return { fill: '#FCE7F3', stroke: '#DB2777' };
    case 'COMPACT':
      return { fill: '#FEF3C7', stroke: '#D97706' };
    case 'VIP':
    case 'RESERVED':
      return { fill: '#F3E8FF', stroke: '#9333EA' };
    default:
      return { fill: '#E5E7EB', stroke: '#475569' };
  }
}

function getPreviewPosition(index: number, countPerRow: number) {
  const safeCount = Math.max(Number(countPerRow) || 1, 1);

  return {
    row: Math.floor(index / safeCount) + 1,
    col: (index % safeCount) + 1,
  };
}

function makeRectPath(space: ParkingSpace, kakao: any) {
  return getParkingSpacePolygonPath(space).map(
    (point) => new kakao.maps.LatLng(point.lat, point.lng),
  );
}

export default function MapEditorPage({ role = 'admin' }: Props) {
  const { session } = useAuth();
  const kakaoLoader = useKakaoMapLoader();
  const ready = kakaoLoader.ready;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const polygonsRef = useRef<any[]>([]);
  const overlaysRef = useRef<any[]>([]);

  const [spaces, setSpaces] = useState<ParkingSpace[]>([]);
  const [typeStyles, setTypeStyles] = useState<SpaceTypeStyle[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => spaces.find((space) => space.id === selectedId) ?? null,
    [spaces, selectedId],
  );

  const mapSections = useMemo(() => {
    const map = new Map<string, string>();

    for (const space of spaces) {
      const id = getSectionId(space);
      if (!id) continue;
      map.set(id, `${getLotName(space)} / ${getSectionName(space)}`);
    }

    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [spaces]);

  const [form, setForm] = useState({
    lat: '',
    lng: '',
    widthMeter: '2.5',
    heightMeter: '5',
    rotationDeg: '0',
    type: 'REGULAR' as SpaceType,
  });

  const [batchForm, setBatchForm] = useState({
    sectionId: '',
    baseLat: '37.402005',
    baseLng: '127.108621',
    spaceGapMeter: '3',
    rowGapMeter: '6',
    countPerRow: '10',
    rotationDeg: '0',
    widthMeter: '2.5',
    heightMeter: '5',
    type: 'REGULAR' as SpaceType,
  });

  const batchTargetSpaces = useMemo(() => {
    const target = batchForm.sectionId
      ? spaces.filter((space) => getSectionId(space) === batchForm.sectionId)
      : spaces;

    return [...target].sort(compareSpacesByCode);
  }, [spaces, batchForm.sectionId]);

  const previewColumnCount = Math.min(
    Math.max(Number(batchForm.countPerRow) || 1, 1),
    12,
  );

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setMessage('');

    try {
      const [spaceRes, styleRes] = await Promise.all([
        apiFetch('/facilities/spaces', {
          accessToken: session.accessToken,
        }),
        apiFetch('/parking/maps/space-type-styles', {
          accessToken: session.accessToken,
        }),
      ]);

      const list = unwrapList<ParkingSpace>(spaceRes).sort(compareSpacesByCode);
      setSpaces(list);
      setTypeStyles(unwrapList<SpaceTypeStyle>(styleRes));

      if (!selectedId && list.length > 0) {
        setSelectedId(list[0].id);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '주차면 목록을 불러오지 못했습니다.');
    }
  }, [session?.accessToken, selectedId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;

    const kakao = window.kakao;
    const map = new kakao.maps.Map(containerRef.current, {
      center: new kakao.maps.LatLng(37.402005, 127.108621),
      level: 2,
    });

    mapRef.current = map;
  }, [ready]);

  useEffect(() => {
    if (!selected) return;

    setForm({
      lat: selected.lat != null ? String(selected.lat) : '',
      lng: selected.lng != null ? String(selected.lng) : '',
      widthMeter: String(selected.widthMeter ?? 2.5),
      heightMeter: String(selected.heightMeter ?? 5),
      rotationDeg: String(selected.rotationDeg ?? 0),
      type: (selected.type as SpaceType) ?? 'REGULAR',
    });

    if (mapRef.current && selected.lat != null && selected.lng != null) {
      const kakao = window.kakao;
      mapRef.current.setCenter(new kakao.maps.LatLng(selected.lat, selected.lng));
      mapRef.current.setLevel(1);
    }
  }, [selected]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;

    const kakao = window.kakao;
    const map = mapRef.current;

    polygonsRef.current.forEach((polygon) => polygon.setMap(null));
    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    polygonsRef.current = [];
    overlaysRef.current = [];

    const bounds = new kakao.maps.LatLngBounds();
    let hasBounds = false;

    spaces.forEach((space) => {
      const path = makeRectPath(space, kakao);
      if (!path.length || space.lat == null || space.lng == null) return;

      const typeStyle = getStyleForType(typeStyles, space.type);
      const isSelected = space.id === selectedId;

      const polygon = new kakao.maps.Polygon({
        map,
        path,
        strokeWeight: isSelected ? 4 : 2,
        strokeColor: isSelected ? '#111827' : typeStyle.strokeColor,
        strokeOpacity: 0.95,
        fillColor: typeStyle.fillColor,
        fillOpacity: isSelected ? 0.95 : 0.75,
      });

      kakao.maps.event.addListener(polygon, 'click', () => {
        setSelectedId(space.id);
      });

      polygonsRef.current.push(polygon);

      const center = new kakao.maps.LatLng(space.lat, space.lng);
      bounds.extend(center);
      hasBounds = true;

      const overlay = new kakao.maps.CustomOverlay({
        map,
        position: center,
        content: `
          <div style="
            padding:4px 8px;
            font-size:12px;
            font-weight:800;
            color:#0f172a;
            background:#ffffffdd;
            border:1px solid #cbd5e1;
            border-radius:999px;
            white-space:nowrap;
          ">${getSpaceCode(space)} · ${typeStyle.label}</div>
        `,
        xAnchor: 0.5,
        yAnchor: 0.5,
      });

      overlaysRef.current.push(overlay);
    });

    if (!selectedId && hasBounds && !bounds.isEmpty()) {
      map.setBounds(bounds);
    }
  }, [ready, spaces, selectedId, typeStyles]);

  function placeAtMapCenter() {
    if (!mapRef.current) return;

    const center = mapRef.current.getCenter();
    setForm((prev) => ({
      ...prev,
      lat: String(center.getLat()),
      lng: String(center.getLng()),
    }));
  }

  function useSelectedAsBatchBase() {
    if (!selected?.lat || !selected?.lng) {
      setMessage('선택한 주차면에 저장된 지도 좌표가 없습니다.');
      return;
    }

    setBatchForm((prev) => ({
      ...prev,
      sectionId: getSectionId(selected),
      baseLat: String(selected.lat),
      baseLng: String(selected.lng),
      rotationDeg: String(selected.rotationDeg ?? prev.rotationDeg),
      widthMeter: String(selected.widthMeter ?? prev.widthMeter),
      heightMeter: String(selected.heightMeter ?? prev.heightMeter),
      type: (selected.type as SpaceType) ?? prev.type,
    }));

    setMessage(`${getSpaceCode(selected)} 좌표를 자동 배치 기준점으로 설정했습니다.`);
  }

  async function autoPlaceVisibleSpaces() {
    if (!session?.accessToken || spaces.length === 0) return;

    const targetSpaces = batchTargetSpaces;

    if (targetSpaces.length === 0) {
      setMessage('자동 배치할 구역의 주차면이 없습니다.');
      return;
    }

    const baseLat = Number(batchForm.baseLat);
    const baseLng = Number(batchForm.baseLng);
    const spaceGapMeter = Number(batchForm.spaceGapMeter);
    const rowGapMeter = Number(batchForm.rowGapMeter);
    const countPerRow = Math.max(1, Number(batchForm.countPerRow));
    const rotationDeg = Number(batchForm.rotationDeg);
    const widthMeter = Number(batchForm.widthMeter);
    const heightMeter = Number(batchForm.heightMeter);

    if (
      Number.isNaN(baseLat) ||
      Number.isNaN(baseLng) ||
      Number.isNaN(spaceGapMeter) ||
      Number.isNaN(rowGapMeter) ||
      Number.isNaN(rotationDeg)
    ) {
      setMessage('자동 배치 기준값을 확인하세요.');
      return;
    }

    const ok = window.confirm(
      `선택한 구역의 ${targetSpaces.length}개 주차면을 기준점부터 자동 배치합니다. 계속할까요?`,
    );

    if (!ok) return;

    setSaving(true);
    setMessage('');

    try {
      const rad = (rotationDeg * Math.PI) / 180;

      const updatedList: ParkingSpace[] = [];

      for (let index = 0; index < targetSpaces.length; index += 1) {
        const space = targetSpaces[index];
        const col = index % countPerRow;
        const row = Math.floor(index / countPerRow);

        const localX = col * spaceGapMeter;
        const localY = row * rowGapMeter;

        const rx = localX * Math.cos(rad) - localY * Math.sin(rad);
        const ry = localX * Math.sin(rad) + localY * Math.cos(rad);

        const lat = baseLat + meterToLat(ry);
        const lng = baseLng + meterToLng(rx, baseLat);

        const updated = await apiFetch<ParkingSpace>(`/parking/maps/spaces/${space.id}`, {
          accessToken: session.accessToken,
          method: 'PATCH',
          body: JSON.stringify({
            lat,
            lng,
            widthMeter,
            heightMeter,
            rotationDeg,
            type: batchForm.type,
            polygonJson: {
              shape: 'RECTANGLE',
              source: `${role}-map-editor-auto-place`,
              autoPlacedAt: new Date().toISOString(),
              index,
              row,
              col,
            },
          }),
        });

        updatedList.push(updated);
      }

      setSpaces((prev) =>
        prev.map((space) => updatedList.find((item) => item.id === space.id) ?? space),
      );
      setMessage(`${updatedList.length}개 주차면을 자동 배치했습니다.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '자동 배치에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function saveSelected() {
    if (!session?.accessToken || !selected) return;

    setSaving(true);
    setMessage('');

    try {
      const body = {
        lat: Number(form.lat),
        lng: Number(form.lng),
        widthMeter: Number(form.widthMeter),
        heightMeter: Number(form.heightMeter),
        rotationDeg: Number(form.rotationDeg),
        type: form.type,
        polygonJson: {
          shape: 'RECTANGLE',
          source: `${role}-map-editor`,
        },
      };

      const updated = await apiFetch<ParkingSpace>(`/parking/maps/spaces/${selected.id}`, {
        accessToken: session.accessToken,
        method: 'PATCH',
        body: JSON.stringify(body),
      });

      setSpaces((prev) =>
        prev.map((space) => (space.id === selected.id ? { ...space, ...updated } : space)),
      );
      setMessage('지도 위치가 저장되었습니다.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '지도 위치 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="grid min-h-[calc(100vh-4rem)] grid-cols-1 gap-6 p-6 xl:grid-cols-[1fr_420px] w-full max-w-none">
      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm w-full max-w-none">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h1 className="text-xl font-black text-slate-950">지도 기반 주차면 편집</h1>
            <p className="text-sm font-bold text-slate-500">
              {role === 'admin'
                ? '전체 주차장의 주차면 위치와 유형을 지도 위에 배치합니다.'
                : '권한 주차장의 주차면 위치와 유형을 지도 위에 배치합니다.'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl border px-4 py-2 text-sm font-bold hover:bg-slate-50"
          >
            새로고침
          </button>
        </div>

        {message ? (
          <div className="m-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-800">
            {message}
          </div>
        ) : null}

        {kakaoLoader.error ? (
          <div className="flex h-[720px] flex-col items-center justify-center bg-slate-100 px-6 text-center">
            <div className="text-sm font-black text-slate-700">지도를 불러올 수 없습니다.</div>
            <div className="mt-2 text-xs font-bold text-slate-500">{kakaoLoader.error}</div>
          </div>
        ) : (
          <div ref={containerRef} className="h-[720px] w-full bg-slate-100" />
        )}

        <div className="border-t bg-slate-50 p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                Fallback Layout
              </p>
              <h2 className="mt-1 text-lg font-black text-slate-950">
                선택 구역 주차면
              </h2>
              <p className="mt-1 text-xs font-bold text-slate-500">
                카카오맵이 표시되지 않아도 선택 구역의 주차면 배치 상태를 확인할 수 있습니다.
              </p>
            </div>

            <div className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-700">
              {batchTargetSpaces.length}개
            </div>
          </div>

          <div
            className="mt-4 grid gap-3 overflow-x-auto"
            style={{
              gridTemplateColumns: `repeat(${previewColumnCount}, minmax(132px, 1fr))`,
            }}
          >
            {batchTargetSpaces.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">
                선택한 구역에 표시할 주차면이 없습니다.
              </div>
            ) : (
              batchTargetSpaces.map((space, index) => {
                const previewPosition = getPreviewPosition(
                  index,
                  Number(batchForm.countPerRow),
                );

                return (
                  <button
                    key={space.id}
                    type="button"
                    onClick={() => setSelectedId(space.id)}
                    className={[
                      'rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md',
                      selectedId === space.id
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-slate-200',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-base font-black text-slate-950">
                        {getSpaceCode(space)}
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600">
                        {getTypeLabel(space.type)}
                      </span>
                    </div>

                    <div className="mt-2 rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">
                      {previewPosition.row}행 {previewPosition.col}열
                    </div>

                    <div className="mt-3 space-y-1 text-[11px] font-bold text-slate-500">
                      <div>
                        좌표: {space.lat != null && space.lng != null ? '저장됨' : '미설정'}
                      </div>
                      <div>
                        크기: {space.widthMeter ?? '-'}m × {space.heightMeter ?? '-'}m
                      </div>
                      <div>
                        회전: {space.rotationDeg ?? 0}°
                      </div>
                      <div>
                        상태: {space.status ?? '-'}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </section>

      <aside className="rounded-3xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black text-slate-950">주차면 설정</h2>

        <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50 p-4">
          <div className="text-sm font-black text-blue-900">구역별 자동 배치</div>
          <p className="mt-1 text-xs font-bold leading-5 text-blue-700">
            선택한 구역의 주차면만 기준 좌표부터 일정 간격으로 배치합니다.
          </p>
          <p className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-xs font-black text-blue-900">
            자동 배치 대상: {batchTargetSpaces.length}개
          </p>

          <button
            type="button"
            onClick={useSelectedAsBatchBase}
            disabled={!selected?.lat || !selected?.lng}
            className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-blue-700 disabled:opacity-50"
          >
            선택 주차면을 기준점으로 사용
          </button>

          <div className="mt-3 rounded-2xl bg-white/80 p-3">
            <div className="text-xs font-black text-blue-900">
              자동 배치 주차면 미리보기
            </div>

            {batchTargetSpaces.length === 0 ? (
              <div className="mt-2 text-xs font-bold text-slate-500">
                선택한 구역에 주차면이 없습니다.
              </div>
            ) : (
              <div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                {batchTargetSpaces.map((space) => (
                  <button
                    key={space.id}
                    type="button"
                    onClick={() => setSelectedId(space.id)}
                    className={[
                      'rounded-full border px-3 py-1 text-xs font-black',
                      selectedId === space.id
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-blue-100 bg-blue-50 text-blue-800',
                    ].join(' ')}
                  >
                    {getSpaceCode(space)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <label className="mt-4 block text-xs font-black text-slate-500">
            자동 배치 대상 구역
            <select
              value={batchForm.sectionId}
              onChange={(event) =>
                setBatchForm((prev) => ({ ...prev, sectionId: event.target.value }))
              }
              className="mt-2 w-full rounded-xl border px-3 py-3 text-sm font-bold text-slate-950"
            >
              <option value="">전체 구역</option>
              {mapSections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.label}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Field
              label="기준 위도"
              value={batchForm.baseLat}
              onChange={(value) => setBatchForm((prev) => ({ ...prev, baseLat: value }))}
            />
            <Field
              label="기준 경도"
              value={batchForm.baseLng}
              onChange={(value) => setBatchForm((prev) => ({ ...prev, baseLng: value }))}
            />
            <Field
              label="가로 간격(m)"
              value={batchForm.spaceGapMeter}
              onChange={(value) => setBatchForm((prev) => ({ ...prev, spaceGapMeter: value }))}
            />
            <Field
              label="줄 간격(m)"
              value={batchForm.rowGapMeter}
              onChange={(value) => setBatchForm((prev) => ({ ...prev, rowGapMeter: value }))}
            />
            <Field
              label="한 줄 개수"
              value={batchForm.countPerRow}
              onChange={(value) => setBatchForm((prev) => ({ ...prev, countPerRow: value }))}
            />
            <Field
              label="회전(도)"
              value={batchForm.rotationDeg}
              onChange={(value) => setBatchForm((prev) => ({ ...prev, rotationDeg: value }))}
            />
            <Field
              label="폭(m)"
              value={batchForm.widthMeter}
              onChange={(value) => setBatchForm((prev) => ({ ...prev, widthMeter: value }))}
            />
            <Field
              label="길이(m)"
              value={batchForm.heightMeter}
              onChange={(value) => setBatchForm((prev) => ({ ...prev, heightMeter: value }))}
            />

            <label className="col-span-2 block text-xs font-black text-slate-500">
              유형
              <select
                value={batchForm.type}
                onChange={(event) =>
                  setBatchForm((prev) => ({ ...prev, type: event.target.value as SpaceType }))
                }
                className="mt-2 w-full rounded-xl border px-3 py-3 text-sm font-bold text-slate-950"
              >
                {(typeStyles.length > 0
                  ? typeStyles
                  : [
                      { type: 'REGULAR', label: '일반' },
                      { type: 'HANDICAPPED', label: '장애인' },
                      { type: 'PREGNANT', label: '임산부' },
                      { type: 'EV', label: '전기차' },
                      { type: 'COMPACT', label: '경차' },
                      { type: 'VIP', label: 'VIP' },
                      { type: 'RESERVED', label: '예약/지정' },
                    ]
                ).map((style) => (
                  <option key={style.type} value={style.type}>
                    {style.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={() => void autoPlaceVisibleSpaces()}
            disabled={saving || batchTargetSpaces.length === 0}
            className="mt-4 w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
          >
            {saving ? '자동 배치 중...' : `선택 구역 ${batchTargetSpaces.length}개 자동 배치`}
          </button>
        </div>

        <label className="mt-4 block text-xs font-black text-slate-500">
          주차면 선택
        </label>
        <select
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          className="mt-2 w-full rounded-xl border px-3 py-3 text-sm font-bold"
        >
          {spaces.map((space) => (
            <option key={space.id} value={space.id}>
              {getLotName(space)} / {getSectionName(space)} / {getSpaceCode(space)}
            </option>
          ))}
        </select>

        {selected ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm">
              <div className="font-black text-slate-950">{getSpaceCode(selected)}</div>
              <div className="mt-1 font-bold text-slate-500">
                {getLotName(selected)} / {getSectionName(selected)}
              </div>
              <div className="mt-1 font-bold text-slate-500">
                상태: {selected.status ?? '-'}
              </div>
            </div>

            <button
              type="button"
              onClick={placeAtMapCenter}
              className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white"
            >
              현재 지도 중심으로 배치
            </button>

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="위도"
                value={form.lat}
                onChange={(value) => setForm((prev) => ({ ...prev, lat: value }))}
              />
              <Field
                label="경도"
                value={form.lng}
                onChange={(value) => setForm((prev) => ({ ...prev, lng: value }))}
              />
              <Field
                label="폭(m)"
                value={form.widthMeter}
                onChange={(value) => setForm((prev) => ({ ...prev, widthMeter: value }))}
              />
              <Field
                label="길이(m)"
                value={form.heightMeter}
                onChange={(value) => setForm((prev) => ({ ...prev, heightMeter: value }))}
              />
              <Field
                label="회전(도)"
                value={form.rotationDeg}
                onChange={(value) => setForm((prev) => ({ ...prev, rotationDeg: value }))}
              />

              <label className="block text-xs font-black text-slate-500">
                유형
                <select
                  value={form.type}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, type: event.target.value as SpaceType }))
                  }
                  className="mt-2 w-full rounded-xl border px-3 py-3 text-sm font-bold text-slate-950"
                >
                  <option value="REGULAR">일반</option>
                  <option value="HANDICAPPED">장애인</option>
                  <option value="EV">전기차</option>
                  <option value="PREGNANT">임산부</option>
                  <option value="COMPACT">경차</option>
                  <option value="VIP">VIP</option>
                  <option value="RESERVED">예약/지정</option>
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={() => void saveSelected()}
              disabled={saving || !form.lat || !form.lng}
              className="w-full rounded-2xl bg-blue-600 px-4 py-4 text-sm font-black text-white disabled:opacity-50"
            >
              {saving ? '저장 중...' : '지도 위치 저장'}
            </button>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">
            선택할 주차면이 없습니다.
          </div>
        )}
      </aside>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs font-black text-slate-500">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border px-3 py-3 text-sm font-bold text-slate-950"
      />
    </label>
  );
}
