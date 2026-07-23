'use client';

import { operatorSpaceTypeLabel } from '@/components/operator/operator-format';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';
import { OperatorKakaoMap } from '@/components/maps/operator-kakao-map';
import type { ParkingLotMapItem, ParkingSpaceMapItem } from '@/types/operator';
import {
  ManualParkingSessionModal,
  type ManualParkingAction,
  type ManualParkingTarget,
} from '@/components/operator/manual-parking-session-modal';

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
  parkingLotCode?: string | null;
  parkingLotOperationMode?: string | null;
  operationMode?: string | null;
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
  activeSession?: Record<string, unknown> | null;
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

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function toText(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function getSpaceId(space: LiveSpace) {
  return space.parkingSpaceId ?? space.spaceId ?? space.id ?? space.spaceCode ?? '';
}

function getSpaceCode(space: LiveSpace | ParkingSpaceMapItem) {
  const raw = asObject(space);

  return (
    toText(raw.spaceCode) ||
    toText(raw.code) ||
    toText(raw.spaceNumber) ||
    toText(raw.id) ||
    '-'
  );
}

function getOperationModeFromMapSource(source: unknown) {
  const raw = source && typeof source === 'object' ? (source as Record<string, unknown>) : {};
  return String(raw.operationMode ?? raw.parkingLotOperationMode ?? '').toUpperCase();
}

function getSessionRecordForManual(source: { activeSession?: Record<string, unknown> | null } | null | undefined) {
  return source?.activeSession && typeof source.activeSession === 'object'
    ? source.activeSession
    : null;
}

function getActiveManualSessionRecord(source: { activeSession?: Record<string, unknown> | null } | null | undefined) {
  const session = getSessionRecordForManual(source);
  const entrySource = String(session?.entrySource ?? '').toUpperCase();

  if (session && entrySource === 'MANUAL' && !session.exitTime) {
    return session;
  }

  return null;
}

function isManualLotSpace(space: ParkingSpaceMapItem) {
  return getOperationModeFromMapSource(space) === 'MANUAL';
}

function canManualEntrySpace(space: ParkingSpaceMapItem) {
  return isManualLotSpace(space) && !getActiveManualSessionRecord(space as any);
}

function canManualExitSpace(space: ParkingSpaceMapItem) {
  return isManualLotSpace(space) && Boolean(getActiveManualSessionRecord(space as any));
}

function getManualTargetFromMapSpace(space: ParkingSpaceMapItem): ManualParkingTarget {
  return {
    id: space.id,
    code: space.code,
    lotName: space.lotName,
    sectionName: space.sectionName,
    operationMode: (space as any).operationMode ?? null,
    activeSession: getSessionRecordForManual(space as any),
  };
}

function getRawState(state?: string | null) {
  return String(state ?? '').trim().toUpperCase();
}

function parseMetadata(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value !== 'string') return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function getNumericValue(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return 0;
}

function getDisplayState(source: LiveSpace | ParkingSpaceMapItem | null | undefined) {
  const raw = asObject(source);
  const session = getSessionRecord(source);
  const metadata = parseMetadata(session.metadata ?? raw.metadata);
  const operationModeForDisplay = getOperationModeFromMapSource(source);

  if (operationModeForDisplay === 'MANUAL') {
    const manualSession = getActiveManualSessionRecord(source as any);

    if (manualSession) {
      return 'MANUAL_OCCUPIED';
    }

    return 'MANUAL_AVAILABLE';
  }
  const rawState = toText(raw.state) || toText(raw.status) || toText(raw.parkingStatus) || toText(raw.occupancyState) || 'UNKNOWN';
  const rawStatusText = [
    rawState,
    toText(session.status),
    toText(session.displayStatus),
    toText(session.paymentStatus),
    toText(session.paymentReason),
    toText(metadata.paymentStatus),
    toText(metadata.paymentReason),
  ]
    .join(' ')
    .toUpperCase();

  const exitedUnpaid =
    rawStatusText.includes('EXITED_UNPAID') ||
    metadata.exitedUnpaid === true ||
    toText(metadata.paymentReason).toUpperCase() === 'EXITED_UNPAID';

  if (exitedUnpaid) return 'EXITED_UNPAID';

  if (
    rawStatusText.includes('TENANT_VISIT_GRACE') ||
    rawStatusText.includes('방문 확인')
  ) {
    return 'TENANT_VISIT_GRACE';
  }

  if (
    rawStatusText.includes('PAID_EXIT_PENDING') ||
    rawStatusText.includes('PAID_GRACE_EXPIRED_STILL_OCCUPIED') ||
    rawStatusText.includes('PAYMENT_GRACE_EXPIRED') ||
    rawStatusText.includes('결제 후 미출차')
  ) {
    return 'PAID_EXIT_PENDING';
  }

  const unpaidAmount = getNumericValue(
    session.unpaidAmount,
    session.invoiceUnpaidAmount,
    metadata.invoiceUnpaidAmount,
    metadata.unpaidAmount,
    metadata.invoiceAmount,
  );
  const hasActiveSession = Boolean(
    session.id ||
      session.sessionNo ||
      session.entryTime ||
      raw.activeSession,
  );
  const hasExitTime = Boolean(session.exitTime || raw.exitTime);
  const sessionStatus = toText(session.status).toUpperCase();

  if (hasActiveSession && !hasExitTime && sessionStatus !== 'CLOSED' && sessionStatus !== 'ENDED' && unpaidAmount > 0) {
    return 'PAID_EXIT_PENDING';
  }

  if (hasExitTime && unpaidAmount > 0) return 'EXITED_UNPAID';

  return rawState;
}

function getStateLabel(state?: string | null) {
  if (state === 'MANUAL_AVAILABLE') return '입차 가능';
  if (state === 'MANUAL_OCCUPIED') return '입차 중';
  const value = getRawState(state);

  switch (value) {
    case 'EMPTY':
    case 'AVAILABLE':
      return '출차';
    case 'OCCUPIED':
      return '입차';
    case 'OCCUPIED_REGISTERED':
    case 'REGISTERED':
      return '입차 등록';
    case 'OCCUPIED_UNREGISTERED':
      return '입차 미등록';
    case 'UNREGISTERED_OVERDUE':
      return '입차 미등록';
    case 'TENANT_VISIT_GRACE':
      return '방문 확인/출차 유예 중';
    case 'PAYMENT_GRACE_EXPIRED':
      return '결제 후 미출차';
    case 'LONG_PARKING_ALERT':
      return '장기 주차';
    case 'EXITED_UNPAID':
      return '출차 후 미결제';
    case 'PAID_EXIT_PENDING':
      return '결제 후 미출차';
    case 'VIOLATION':
      return '위반';
    case 'SENSOR_ERROR':
      return '센서 오류';
    case 'MAINTENANCE':
      return '점검';
    case 'DISABLED':
      return '비활성';
    case 'RESERVED':
      return '예약';
    default:
      return state ?? '-';
  }
}

function getStateClass(state?: string | null) {
  const value = getRawState(state);

  switch (value) {
    case 'EMPTY':
    case 'AVAILABLE':
      return 'border-slate-200 bg-white text-slate-700';
    case 'OCCUPIED':
      return 'border-amber-300 bg-amber-50 text-amber-900';
    case 'OCCUPIED_REGISTERED':
    case 'REGISTERED':
      return 'border-emerald-300 bg-emerald-50 text-emerald-900';
    case 'OCCUPIED_UNREGISTERED':
    case 'UNREGISTERED_OVERDUE':
      return 'border-red-300 bg-red-50 text-red-900';
    case 'TENANT_VISIT_GRACE':
      return 'border-sky-300 bg-sky-50 text-sky-900';
    case 'PAYMENT_GRACE_EXPIRED':
    case 'LONG_PARKING_ALERT':
    case 'EXITED_UNPAID':
    case 'PAID_EXIT_PENDING':
    case 'VIOLATION':
      return 'border-red-300 bg-red-50 text-red-900';
    case 'SENSOR_ERROR':
    case 'MAINTENANCE':
      return 'border-slate-400 bg-slate-100 text-slate-800';
    case 'DISABLED':
      return 'border-slate-200 bg-slate-100 text-slate-500';
    default:
      return 'border-slate-200 bg-white text-slate-700';
  }
}

function getStateLabelClass(state?: string | null) {
  if (state === 'MANUAL_AVAILABLE') return 'bg-emerald-600 text-white';
  if (state === 'MANUAL_OCCUPIED') return 'bg-blue-600 text-white';
  const value = getRawState(state);

  switch (value) {
    case 'EMPTY':
    case 'AVAILABLE':
      return 'bg-white text-slate-700 ring-1 ring-inset ring-slate-200';
    case 'OCCUPIED':
      return 'bg-amber-500 text-white';
    case 'OCCUPIED_REGISTERED':
    case 'REGISTERED':
      return 'bg-emerald-600 text-white';
    case 'OCCUPIED_UNREGISTERED':
    case 'UNREGISTERED_OVERDUE':
      return 'bg-red-600 text-white';
    case 'TENANT_VISIT_GRACE':
      return 'bg-sky-600 text-white';
    case 'PAYMENT_GRACE_EXPIRED':
    case 'LONG_PARKING_ALERT':
    case 'EXITED_UNPAID':
    case 'PAID_EXIT_PENDING':
    case 'VIOLATION':
      return 'bg-red-600 text-white';
    case 'SENSOR_ERROR':
    case 'MAINTENANCE':
      return 'bg-slate-700 text-white';
    case 'DISABLED':
      return 'bg-slate-500 text-white';
    case 'RESERVED':
      return 'bg-blue-600 text-white';
    default:
      return 'bg-white text-slate-700 ring-1 ring-inset ring-slate-200';
  }
}

function getAlertBadges(state?: string | null) {
  if (state === 'MANUAL_AVAILABLE') return [];
  if (state === 'MANUAL_OCCUPIED') return [];
  const value = getRawState(state);

  // 상태 라벨 자체가 이미 알람 의미를 갖는 경우에는 보조 배지를 중복으로 붙이지 않습니다.
  // 예: EXITED_UNPAID는 "출차 후 미결제" 하나만 표시하고, 별도 "미결제" 배지는 생략합니다.
  if (
    value.includes('UNREGISTERED') ||
    value.includes('EXITED_UNPAID') ||
    value.includes('TENANT_VISIT') ||
    value.includes('PAID_EXIT_PENDING') ||
    value.includes('VIOLATION') ||
    value.includes('SENSOR_ERROR') ||
    value.includes('LONG_PARKING') ||
    value.includes('PAYMENT_GRACE')
  ) {
    return [];
  }

  return [];
}
function getMapSpaceStatusLabel(space: LiveSpace | ParkingSpaceMapItem) {
  if (isManualLotSpace(space as ParkingSpaceMapItem)) {
    return canManualExitSpace(space as ParkingSpaceMapItem) ? '입차 중' : '입차 가능';
  }

  return getStateLabel(getDisplayState(space));
}

function getMapSpaceStatusClass(space: LiveSpace | ParkingSpaceMapItem) {
  if (isManualLotSpace(space as ParkingSpaceMapItem)) {
    return canManualExitSpace(space as ParkingSpaceMapItem)
      ? 'bg-blue-600 text-white'
      : 'bg-emerald-600 text-white';
  }

  return getStateLabelClass(getDisplayState(space));
}


function getMapSpaceAlertBadges(space: LiveSpace | ParkingSpaceMapItem) {
  if (isManualLotSpace(space as ParkingSpaceMapItem)) {
    return [];
  }

  return getAlertBadges(getDisplayState(space));
}


function toOccupancyState(state?: string) {
  switch (state) {
    case 'EMPTY':
      return 'EMPTY';
    case 'OCCUPIED_REGISTERED':
    case 'REGISTERED':
      return 'OCCUPIED_REGISTERED';
    case 'OCCUPIED':
    case 'MANUAL_OCCUPIED':
      return 'OCCUPIED';
    case 'OCCUPIED_UNREGISTERED':
    case 'UNREGISTERED_OVERDUE':
      return 'OCCUPIED_UNREGISTERED';
    case 'PAYMENT_GRACE_EXPIRED':
    case 'LONG_PARKING_ALERT':
    case 'EXITED_UNPAID':
    case 'PAID_EXIT_PENDING':
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
  return date.toLocaleString('ko-KR', {
    hour12: false,
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getSessionRecord(source: LiveSpace | ParkingSpaceMapItem | null | undefined) {
  const raw = asObject(source);
  return asObject(
    raw.activeSession ??
      raw.session ??
      raw.parkingSession ??
      raw.currentSession ??
      {},
  );
}

function getVehiclePlate(source: LiveSpace | ParkingSpaceMapItem | null | undefined) {
  const raw = asObject(source);
  const session = getSessionRecord(source);

  return (
    toText(session.plateNumber) ||
    toText(session.vehiclePlate) ||
    toText(session.vehicleNumber) ||
    toText(session.carNumber) ||
    toText(raw.plateNumber) ||
    toText(raw.vehiclePlate) ||
    '-'
  );
}

function getContact(source: LiveSpace | ParkingSpaceMapItem | null | undefined) {
  const raw = asObject(source);
  const session = getSessionRecord(source);

  return (
    toText(session.phone) ||
    toText(session.phoneNumber) ||
    toText(session.contact) ||
    toText(session.contactPhone) ||
    toText(session.driverPhone) ||
    toText(session.mobile) ||
    toText(raw.phone) ||
    toText(raw.phoneNumber) ||
    toText(raw.contact) ||
    '-'
  );
}

function getEntryTime(source: LiveSpace | ParkingSpaceMapItem | null | undefined) {
  const raw = asObject(source);
  const session = getSessionRecord(source);

  return (
    toText(session.entryTime) ||
    toText(session.enteredAt) ||
    toText(session.startedAt) ||
    toText(raw.entryTime) ||
    toText(raw.enteredAt) ||
    null
  );
}

function getAccruedAmount(source: ParkingSpaceMapItem | null | undefined) {
  const session = getSessionRecord(source);
  const value = session.accruedFeeAmount ?? session.accruedAmount ?? session.feeAmount;
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isRegistered(source: ParkingSpaceMapItem | null | undefined) {
  const session = getSessionRecord(source);
  const value = session.isRegistered ?? session.registered;
  if (typeof value === 'boolean') return value;
  return getRawState(toText(asObject(source).status)).includes('REGISTERED');
}

function isRegistrationRequiredByState(state?: string | null) {
  const value = getRawState(state);
  return value.includes('OCCUPIED_UNREGISTERED') || value.includes('UNREGISTERED_OVERDUE');
}

function getBasePath(role?: string) {
  if (role === 'admin') return '/admin';
  if (role === 'manager') return '/manager';
  return '/operator';
}

const STATUS_LEGEND = [
  { label: '출차', className: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-200' },
  { label: '입차', className: 'bg-amber-500 text-white' },
  { label: '입차 등록', className: 'bg-emerald-600 text-white' },
  { label: '입차 미등록', className: 'bg-red-600 text-white' },
  { label: '출차 후 미결제', className: 'bg-red-600 text-white' },
  { label: '결제 후 미출차', className: 'bg-red-600 text-white' },
  { label: '점검/장애', className: 'bg-slate-700 text-white' },
];

export function MapPage({
  role = 'operator',
  title = '담당 구역 맵',
  description = '승인받은 주차 구역의 주차면만 표시됩니다.',
}: Props) {
  const { session } = useAuth();
  const mapDetailRef = useRef<HTMLDivElement | null>(null);

  const [spaces, setSpaces] = useState<LiveSpace[]>([]);
  const [typeStyles, setTypeStyles] = useState<SpaceTypeStyle[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sectionFilter, setSectionFilter] = useState('');
  const [selectedMapSpace, setSelectedMapSpace] = useState<ParkingSpaceMapItem | null>(null);
  const [manualAction, setManualAction] = useState<ManualParkingAction>('entry');
  const [manualTarget, setManualTarget] = useState<ManualParkingTarget | null>(null);

  const basePath = getBasePath(role);

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
      const displayState = getDisplayState(space);
      const isOccupied = toOccupancyState(displayState) !== 'EMPTY';

      if (!existing) {
        map.set(space.parkingLotId, {
          id: space.parkingLotId,
          name: space.parkingLotName ?? '-',
          code: space.parkingLotName ?? '-',
          lat: space.lat ?? null,
          lng: space.lng ?? null,
          summary: {
            totalSpaces: 1,
            availableSpaces: toOccupancyState(displayState) === 'EMPTY' ? 1 : 0,
            occupiedSpaces: isOccupied ? 1 : 0,
            activeSessions: space.activeSession ? 1 : 0,
          },
          operation: {
            status: 'ACTIVE',
            openFaultCount: displayState === 'SENSOR_ERROR' ? 1 : 0,
          },
        });
      } else {
        existing.summary.totalSpaces += 1;
        if (toOccupancyState(displayState) === 'EMPTY') existing.summary.availableSpaces += 1;
        if (isOccupied) existing.summary.occupiedSpaces += 1;
        if (space.activeSession) existing.summary.activeSessions += 1;
        if (displayState === 'SENSOR_ERROR') existing.operation.openFaultCount += 1;

        if (existing.lat == null && space.lat != null) existing.lat = space.lat;
        if (existing.lng == null && space.lng != null) existing.lng = space.lng;
      }
    }

    return Array.from(map.values());
  }, [spaces]);

  const mapSpaces = useMemo<ParkingSpaceMapItem[]>(() => {
    return filteredSpaces
      .filter((space) => space.lat != null && space.lng != null)
      .map((space) => {
        const displayState = getDisplayState(space);

        return {
        id: getSpaceId(space),
        code: getSpaceCode(space),
        type: space.type ?? 'REGULAR',
        status: displayState,
        occupancyState: toOccupancyState(displayState),
        lotId: space.parkingLotId ?? '',
        lotName: space.parkingLotName ?? '-',
        lotCode: space.parkingLotCode ?? null,
        operationMode: space.parkingLotOperationMode ?? space.operationMode ?? null,
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
      };
      });
  }, [filteredSpaces]);

  function getMapSpaceItemForCard(space: LiveSpace) {
    const raw = space as Record<string, unknown>;
    const candidates = [
      raw.parkingSpaceId,
      raw.spaceId,
      raw.id,
      raw.spaceCode,
      raw.code,
      raw.spaceNumber,
    ]
      .filter(Boolean)
      .map(String);

    return (
      mapSpaces.find((item) => {
        const itemRaw = item as unknown as Record<string, unknown>;
        const itemCandidates = [
          itemRaw.id,
          itemRaw.parkingSpaceId,
          itemRaw.spaceId,
          itemRaw.code,
          itemRaw.spaceCode,
          itemRaw.spaceNumber,
        ]
          .filter(Boolean)
          .map(String);

        return candidates.some((candidate) => itemCandidates.includes(candidate));
      }) ?? null
    );
  }

  function renderManualMapCardButtons(space: LiveSpace) {
    const mapItem = getMapSpaceItemForCard(space);

    if (!mapItem || !isManualLotSpace(mapItem)) {
      return null;
    }

    return renderManualMapButtons(mapItem);
  }

  function renderManualMapButtons(space: ParkingSpaceMapItem) {
    if (canManualEntrySpace(space)) {
      return (
        <button
          type="button"
          onClick={() => openManualModal('entry', space)}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-black text-white hover:bg-blue-700"
        >
          입차 등록
        </button>
      );
    }

    if (canManualExitSpace(space)) {
      return (
        <button
          type="button"
          onClick={() => openManualModal('exit', space)}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-black text-white hover:bg-slate-800"
        >
          출차 등록
        </button>
      );
    }

    return null;
  }

  function openManualModal(action: ManualParkingAction, space: ParkingSpaceMapItem) {
    setManualAction(action);
    setManualTarget(getManualTargetFromMapSpace(space));
  }

  function closeManualModal() {
    setManualTarget(null);
  }

  function handleMapSpaceClick(space: ParkingSpaceMapItem) {
    setSelectedMapSpace(space);
    window.setTimeout(() => {
      mapDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  }

  return (
    <main className="flex flex-col gap-6 p-6 w-full max-w-none">
      <section className="w-full max-w-none rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">주차장 지도</p>
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
            <p className="text-sm font-medium text-blue-600">실시간 주차 지도</p>
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
            onSpaceClick={handleMapSpaceClick}
          />
        )}

        {selectedMapSpace ? (
          <div ref={mapDetailRef} className="mt-4 scroll-mt-6 rounded-2xl bg-slate-50 p-4 text-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="font-black text-slate-950">
                  선택 주차면: {selectedMapSpace.code}
                </div>
                <div className="mt-1 text-slate-500">
                  {selectedMapSpace.lotName} / {selectedMapSpace.sectionName}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-black ${getMapSpaceStatusClass(selectedMapSpace)}`}
                  >
                    {getMapSpaceStatusLabel(selectedMapSpace)}
                  </span>
                  {getMapSpaceAlertBadges(selectedMapSpace).map((badge) => (
                    <span
                      key={badge}
                      className="inline-flex whitespace-nowrap rounded-full bg-red-600 px-2.5 py-1 text-xs font-black text-white"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {renderManualMapButtons(selectedMapSpace)}
              </div>

              <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
                <div className="text-xs font-black text-slate-400">현재 요금</div>
                <div className="mt-1 text-xl font-black text-slate-950">
                  {getAccruedAmount(selectedMapSpace) != null
                    ? `${Number(getAccruedAmount(selectedMapSpace)).toLocaleString()}원`
                    : '-'}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-white p-3">
                <div className="text-xs font-black text-slate-400">차량 번호</div>
                <div className="mt-1 font-black text-slate-900">
                  {getVehiclePlate(selectedMapSpace)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-xs font-black text-slate-400">연락처</div>
                <div className="mt-1 font-black text-slate-900">
                  {getContact(selectedMapSpace)}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-xs font-black text-slate-400">입차 시간</div>
                <div className="mt-1 font-black text-slate-900">
                  {formatDateTime(getEntryTime(selectedMapSpace))}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3">
                <div className="text-xs font-black text-slate-400">등록 상태</div>
                <div className="mt-1 font-black text-slate-900">
                  {isManualLotSpace(selectedMapSpace)
                    ? canManualExitSpace(selectedMapSpace)
                      ? '입차 중'
                      : '입차 가능'
                    : getSessionRecord(selectedMapSpace).entryTime || selectedMapSpace.activeSession
                      ? isRegistered(selectedMapSpace)
                        ? '등록 완료'
                        : '등록 필요'
                      : '-'}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-3">
              <Link
                href={`${basePath}/parking/sessions?space=${encodeURIComponent(String(selectedMapSpace.code))}&action=detail`}
                className="rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-black text-white"
              >
                상세 보기
              </Link>

              {!isManualLotSpace(selectedMapSpace) ? (
                <>
                  <Link
                    href={`${basePath}/parking/sessions?space=${encodeURIComponent(String(selectedMapSpace.code))}&action=register`}
                    className={`rounded-2xl px-4 py-3 text-center text-sm font-black text-white ${
                      isRegistrationRequiredByState(selectedMapSpace.status)
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    주차 등록
                  </Link>
                  <Link
                    href={`${basePath}/parking/sessions?space=${encodeURIComponent(String(selectedMapSpace.code))}&action=payment`}
                    className="rounded-2xl bg-amber-500 px-4 py-3 text-center text-sm font-black text-white"
                  >
                    결제 등록
                  </Link>
                </>
              ) : null}
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
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span className="mr-1 font-semibold text-slate-600">색상 Legend</span>
          {STATUS_LEGEND.map((item) => (
            <span
              key={item.label}
              className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-bold ${item.className}`}
            >
              {item.label}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filteredSpaces.length === 0 ? (
            <div className="col-span-full rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
              표시할 담당 주차면이 없습니다.
            </div>
          ) : (
            filteredSpaces.map((space, index) => {
              const displayState = getDisplayState(space);
              const needsRegistration = isRegistrationRequiredByState(displayState);
              const targetHref = `${basePath}/parking/sessions?space=${encodeURIComponent(getSpaceCode(space))}&action=register`;

              return (
                <div
                  key={getSpaceId(space) || index}
                  role={needsRegistration ? 'button' : undefined}
                  tabIndex={needsRegistration ? 0 : undefined}
                  onClick={() => {
                    if (needsRegistration && typeof window !== 'undefined') {
                      window.location.href = targetHref;
                    }
                  }}
                  onKeyDown={(event) => {
                    if (!needsRegistration) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      window.location.href = targetHref;
                    }
                  }}
                  className={`rounded-2xl border p-4 shadow-sm ${needsRegistration ? 'cursor-pointer ring-1 ring-inset ring-red-200' : ''} ${getStateClass(displayState)}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-black ${getMapSpaceStatusClass(space)}`}
                    >
                      {getMapSpaceStatusLabel(space)}
                    </span>
                    {getMapSpaceAlertBadges(space).map((badge) => (
                      <span
                        key={badge}
                        className="inline-flex whitespace-nowrap rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-black text-white"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>

                  <p className="mt-3 text-xs font-medium opacity-80">
                    {space.parkingLotName ?? '-'} / {space.sectionCode ?? space.sectionName ?? '-'}
                  </p>
                  <p className="mt-2 text-xl font-bold">{getSpaceCode(space)}</p>
                  <p className="mt-2 text-xs opacity-80">
                    주차면 유형: {operatorSpaceTypeLabel(space.type)}
                  </p>
                  <p className="mt-3 text-xs opacity-80">
                    차량 번호: {getVehiclePlate(space)}
                  </p>
                  <p className="mt-1 text-xs opacity-80">
                    연락처: {getContact(space)}
                  </p>
                  <p className="mt-1 text-xs opacity-80">
                    입차 시간: {formatDateTime(getEntryTime(space))}
                  </p>

                  <div className="map-card-manual-action-buttons mt-3 flex flex-wrap gap-2">
                    {renderManualMapCardButtons(space)}
                  </div>
                  {!isManualLotSpace(space as ParkingSpaceMapItem) && needsRegistration ? (
                    <div className="mt-3 inline-flex whitespace-nowrap rounded-xl bg-red-600 px-3 py-1.5 text-[11px] font-black text-white">
                      주차 등록
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </section>
      <ManualParkingSessionModal
        open={manualTarget != null}
        action={manualAction}
        target={manualTarget}
        accessToken={session?.accessToken}
        onClose={closeManualModal}
        onSaved={load}
      />
    </main>
  );
}

export default MapPage;