'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRealtime } from '@/components/providers/realtime-provider';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';
import type { ConsoleRole } from '@/lib/console-role';
import { asRecord, str, getRegion, getDistrict } from '@/lib/parking-live/region';
import type { ParkingLotMapItem, ParkingSpaceMapItem } from '@/types/operator';
import {
  ManualParkingSessionModal,
  type ManualParkingAction,
  type ManualParkingTarget,
} from '@/components/operator/manual-parking-session-modal';

type Props = {
  role?: ConsoleRole;
  title?: string;
  description?: string;
};

type LiveSpace = {
  id?: string;
  parkingSpaceId?: string;
  parkingLotId?: string;
  parkingLotName?: string;
  parkingLotCode?: string | null;
  parkingLotOperationMode?: string | null;
  operationMode?: string | null;
  lotId?: string;
  lotName?: string;
  sectionId?: string;
  sectionCode?: string;
  sectionName?: string | null;
  parkingSectionName?: string | null;
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
  status?: string | null;
  occupancyState?: string | null;
  parkingStatus?: string | null;
  sensorStatus?: string | null;
  region?: string | null;
  district?: string | null;
  address?: string | null;
  activeSession?: Record<string, unknown> | null;
};

type LiveResponse = {
  ok?: boolean;
  generatedAt?: string;
  spaces?: LiveSpace[];
};

type GridData = {
  parkingLots: ParkingLotMapItem[];
  spaces: ParkingSpaceMapItem[];
};

type QuickGridFilter = {
  mode: string;
  target: string;
};

function normalizeQuickValue(value: string | null) {
  return String(value ?? '').trim().toLowerCase();
}

function getLiveSpaceId(space: LiveSpace) {
  return space.parkingSpaceId ?? space.spaceId ?? space.id ?? space.spaceCode ?? space.code ?? '';
}

function getLiveSpaceCode(space: LiveSpace) {
  return space.spaceCode ?? space.code ?? space.spaceNumber ?? getLiveSpaceId(space) ?? '-';
}

function getLiveLotId(space: LiveSpace) {
  return space.parkingLotId ?? space.lotId ?? '';
}

function getLiveLotName(space: LiveSpace) {
  return space.parkingLotName ?? space.lotName ?? getLiveLotId(space) ?? '-';
}

function getLiveSectionName(space: LiveSpace) {
  return space.sectionCode ?? space.sectionName ?? space.parkingSectionName ?? space.sectionId ?? '-';
}

function getManualLiveState(space: LiveSpace) {
  const mode = String(space.parkingLotOperationMode ?? '').toUpperCase();
  if (mode !== 'MANUAL') return null;

  const session = getSessionRecord(space as any);
  const entrySource = String(session?.entrySource ?? '').toUpperCase();

  if (session && entrySource === 'MANUAL' && !session.exitTime) {
    return 'MANUAL_OCCUPIED';
  }

  return 'EMPTY';
}

function getDisplayStateByOperationMode(space: LiveSpace) {
  const operationMode = getOperationModeFromSpace(space);

  if (operationMode !== 'MANUAL') {
    return getLiveState(space);
  }

  const manualSession = getActiveManualSessionRecord(space as any);

  if (manualSession) {
    return 'MANUAL_OCCUPIED';
  }

  return 'MANUAL_AVAILABLE';
}

function getLiveState(space: LiveSpace) {
  // 화면 상태 표시는 API 원본 state/status를 우선 사용합니다.
  // occupancyState는 요약/분류용 값이라 EXITED_UNPAID 같은 상세 상태가 VIOLATION으로 뭉개질 수 있습니다.
  return space.state ?? space.status ?? space.parkingStatus ?? space.occupancyState ?? 'UNKNOWN';
}

function getOperationModeFromSpace(source: unknown) {
  const raw = source && typeof source === 'object' ? (source as Record<string, unknown>) : {};
  return String(raw.operationMode ?? raw.parkingLotOperationMode ?? '').toUpperCase();
}

function getSessionRecord(source: { activeSession?: Record<string, unknown> | null } | null | undefined) {
  return source?.activeSession && typeof source.activeSession === 'object'
    ? source.activeSession
    : null;
}

function getActiveManualSessionRecord(source: { activeSession?: Record<string, unknown> | null } | null | undefined) {
  const session = getSessionRecord(source);
  const entrySource = String(session?.entrySource ?? '').toUpperCase();

  if (session && entrySource === 'MANUAL' && !session.exitTime) {
    return session;
  }

  return null;
}

function isManualLotSpace(space: ParkingSpaceMapItem) {
  return getOperationModeFromSpace(space) === 'MANUAL';
}

function canManualEntrySpace(space: ParkingSpaceMapItem) {
  return isManualLotSpace(space) && !getActiveManualSessionRecord(space as any);
}

function canManualExitSpace(space: ParkingSpaceMapItem) {
  return isManualLotSpace(space) && Boolean(getActiveManualSessionRecord(space as any));
}

function matchesQuickGridTarget(space: ParkingSpaceMapItem, target: string) {
  const normalizedTarget = normalizeQuickValue(target);
  if (!normalizedTarget) return true;

  const status = getNormalizedStatus(space);
  const upperStatus = status.toUpperCase();
  const manual = isManualLotSpace(space);

  switch (normalizedTarget) {
    case 'empty':
      return manual ? canManualEntrySpace(space) : toOccupancyState(status) === 'EMPTY';

    case 'manual-active':
      return manual && canManualExitSpace(space);

    case 'occupied':
      return !manual && toOccupancyState(status) !== 'EMPTY';

    case 'registration':
      return !manual && isRegistrationRequired(space);

    case 'payment':
      return (
        !manual &&
        (
          upperStatus.includes('PAYMENT') ||
          upperStatus.includes('PAID_EXIT') ||
          upperStatus.includes('EXITED_UNPAID') ||
          upperStatus.includes('LONG_PARKING_ALERT')
        )
      );

    case 'sensor-error':
      return !manual && upperStatus.includes('SENSOR_ERROR');

    case 'alerts':
      return (
        upperStatus.includes('VIOLATION') ||
        upperStatus.includes('UNREGISTERED') ||
        upperStatus.includes('PAYMENT') ||
        upperStatus.includes('EXITED_UNPAID') ||
        upperStatus.includes('SENSOR_ERROR') ||
        upperStatus.includes('LONG_PARKING_ALERT')
      );

    default:
      return true;
  }
}

function getQuickFilterTitle(filter: QuickGridFilter) {
  const mode = normalizeQuickValue(filter.mode);
  const target = normalizeQuickValue(filter.target);

  const modeLabel =
    mode === 'manual' ? '수동 운영' : mode === 'sensor' ? '센서 운영' : '전체 운영';

  const targetLabelMap: Record<string, string> = {
    empty: '빈 주차면',
    'manual-active': '수동 입차 중',
    occupied: '점유 주차면',
    registration: '입차 미등록',
    payment: '결제/청구 필요',
    'sensor-error': '센서 오류',
    alerts: '주의 필요',
  };

  return `${modeLabel} · ${targetLabelMap[target] ?? '전체'}`;
}

function getManualTargetFromSpace(space: ParkingSpaceMapItem): ManualParkingTarget {
  return {
    id: space.id,
    code: space.code,
    lotName: space.lotName,
    sectionName: space.sectionName,
    operationMode: (space as any).operationMode ?? null,
    activeSession: getSessionRecord(space as any),
  };
}

function toOccupancyState(state?: string | null) {
  switch ((state ?? '').toUpperCase()) {
    case 'EMPTY':
    case 'AVAILABLE':
      return 'EMPTY';
    case 'OCCUPIED_REGISTERED':
    case 'REGISTERED':
      return 'OCCUPIED_REGISTERED';
    case 'OCCUPIED_UNREGISTERED':
    case 'UNREGISTERED_OVERDUE':
      return 'OCCUPIED_UNREGISTERED';
    case 'OCCUPIED':
    case 'MANUAL_OCCUPIED':
      return 'OCCUPIED';
    case 'PAYMENT_GRACE_EXPIRED':
    case 'LONG_PARKING_ALERT':
    case 'EXITED_UNPAID':
    case 'SENSOR_ERROR':
    case 'VIOLATION':
      return 'VIOLATION';
    default:
      return state ?? 'UNKNOWN';
  }
}

function mapLiveResponseToGridData(response: LiveResponse): GridData {
  const liveSpaces = Array.isArray(response?.spaces) ? response.spaces : [];
  const parkingLots = new Map<string, ParkingLotMapItem>();

  const spaces = liveSpaces.map((space) => {
    const lotId = getLiveLotId(space);
    const lotName = getLiveLotName(space);
    const state = getDisplayStateByOperationMode(space);
    const occupied = toOccupancyState(state) !== 'EMPTY';

    if (lotId) {
      const existing = parkingLots.get(lotId) as any;
      if (!existing) {
        parkingLots.set(
          lotId,
          {
            id: lotId,
            name: lotName,
            code: lotName,
            region: space.region ?? undefined,
            district: space.district ?? undefined,
            address: space.address ?? undefined,
            lat: space.lat ?? null,
            lng: space.lng ?? null,
            summary: {
              totalSpaces: 1,
              availableSpaces: occupied ? 0 : 1,
              occupiedSpaces: occupied ? 1 : 0,
              activeSessions: space.activeSession ? 1 : 0,
            },
            operation: {
              status: 'ACTIVE',
              openFaultCount: state === 'SENSOR_ERROR' ? 1 : 0,
            },
          } as ParkingLotMapItem,
        );
      } else {
        existing.summary.totalSpaces += 1;
        if (!occupied) existing.summary.availableSpaces += 1;
        if (occupied) existing.summary.occupiedSpaces += 1;
        if (space.activeSession) existing.summary.activeSessions += 1;
        if (state === 'SENSOR_ERROR') existing.operation.openFaultCount += 1;
        if (existing.lat == null && space.lat != null) existing.lat = space.lat;
        if (existing.lng == null && space.lng != null) existing.lng = space.lng;
        if (!existing.region && space.region) existing.region = space.region;
        if (!existing.district && space.district) existing.district = space.district;
        if (!existing.address && space.address) existing.address = space.address;
      }
    }

    return {
      id: getLiveSpaceId(space),
      code: getLiveSpaceCode(space),
      type: space.type ?? 'REGULAR',
      status: state,
      occupancyState: toOccupancyState(state),
      parkingStatus: state,
      lotId,
      lotName,
      parkingLotName: lotName,
      sectionId: space.sectionId ?? '',
      sectionName: getLiveSectionName(space),
      sectionCode: space.sectionCode ?? undefined,
      lat: space.lat ?? null,
      lng: space.lng ?? null,
      widthMeter: space.widthMeter ?? 2.5,
      heightMeter: space.heightMeter ?? 5,
      rotationDeg: space.rotationDeg ?? 0,
      region: space.region ?? undefined,
      district: space.district ?? undefined,
      labelVisible: true,
      isMyRecentSpace: false,
      lotCode: space.parkingLotCode ?? null,
      operationMode: space.parkingLotOperationMode ?? space.operationMode ?? null,
      activeSession: space.activeSession ?? null,
    } as ParkingSpaceMapItem;
  });

  return {
    parkingLots: Array.from(parkingLots.values()),
    spaces,
  };
}

function getSpaceRegion(space: ParkingSpaceMapItem, lots: ParkingLotMapItem[]) {
  const direct = getRegion(space);
  if (direct !== 'All Regions') return direct;

  const lot = lots.find((item) => item.id === space.lotId);
  return lot ? getRegion(lot) : 'All Regions';
}

function getSpaceDistrict(space: ParkingSpaceMapItem, lots: ParkingLotMapItem[]) {
  const direct = getDistrict(space);
  if (direct !== 'All Districts') return direct;

  const lot = lots.find((item) => item.id === space.lotId);
  return lot ? getDistrict(lot) : 'All Districts';
}

function getSpaceLotName(space: ParkingSpaceMapItem, lots: ParkingLotMapItem[]) {
  const raw = asRecord(space);

  return (
    str(raw.lotName) ||
    str(raw.parkingLotName) ||
    lots.find((lot) => lot.id === space.lotId)?.name ||
    space.lotId ||
    '-'
  );
}

function getSpaceSectionName(space: ParkingSpaceMapItem) {
  const raw = asRecord(space);

  return (
    str(raw.sectionName) ||
    str(raw.parkingSectionName) ||
    str(raw.sectionCode) ||
    space.sectionId ||
    '-'
  );
}

function getSpaceCode(space: ParkingSpaceMapItem) {
  const raw = asRecord(space);

  return (
    str(raw.code) ||
    str(raw.spaceCode) ||
    str(raw.spaceNumber) ||
    space.id ||
    '-'
  );
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

function getSpaceRawStatusValue(space: ParkingSpaceMapItem) {
  const raw = asRecord(space);

  return (
    str(raw.status) ||
    str(raw.state) ||
    str(raw.parkingStatus) ||
    str(raw.occupancyState) ||
    '-'
  );
}

function getNumericValue(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return 0;
}

function getSpaceStatusValue(space: ParkingSpaceMapItem) {
  const raw = asRecord(space);
  const session = getActiveSession(space);
  const metadata = parseMetadata(session.metadata ?? raw.metadata);
  const rawStatus = getSpaceRawStatusValue(space);
  const rawStatusText = [
    rawStatus,
    str(session.status),
    str(session.displayStatus),
    str(session.paymentStatus),
    str(session.paymentReason),
    str(metadata.paymentStatus),
    str(metadata.paymentReason),
  ]
    .join(' ')
    .toUpperCase();

  const exitedUnpaid =
    rawStatusText.includes('EXITED_UNPAID') ||
    metadata.exitedUnpaid === true ||
    str(metadata.paymentReason).toUpperCase() === 'EXITED_UNPAID';

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
  const sessionStatus = str(session.status).toUpperCase();

  if (hasActiveSession && !hasExitTime && sessionStatus !== 'CLOSED' && sessionStatus !== 'ENDED' && unpaidAmount > 0) {
    return 'PAID_EXIT_PENDING';
  }

  if (hasExitTime && unpaidAmount > 0) return 'EXITED_UNPAID';

  return rawStatus;
}

function getNormalizedStatus(space: ParkingSpaceMapItem) {
  return getSpaceStatusValue(space).trim().toUpperCase();
}

function statusLabel(space: ParkingSpaceMapItem) {
  const value = getNormalizedStatus(space);
  if (value === 'MANUAL_AVAILABLE') return '입차 가능';
  if (value === 'MANUAL_OCCUPIED') return '입차 중';

  if (!value || value === '-') return '-';
  if (value.includes('EXITED_UNPAID')) return '출차 후 미결제';
  if (value.includes('TENANT_VISIT_GRACE')) return '방문 확인/출차 유예 중';
  if (value.includes('PAID_EXIT_PENDING') || value.includes('PAYMENT_GRACE_EXPIRED')) return '결제 후 미출차';
  if (value.includes('VIOLATION') || value.includes('위반')) return '위반';
  if (value.includes('UNREGISTERED') || value.includes('미등록')) return '입차 미등록';
  if (value.includes('REGISTERED') || value.includes('등록')) return '입차 등록';
  if (value.includes('OCCUPIED') || value.includes('입차')) return '입차';
  if (value.includes('EMPTY') || value.includes('AVAILABLE') || value.includes('출차')) {
    return '출차';
  }
  if (value.includes('FAULT') || value.includes('ERROR') || value.includes('장애')) {
    return '장애';
  }
  if (value.includes('MAINTENANCE') || value.includes('점검')) return '점검';
  if (value.includes('DISABLED') || value.includes('비활성')) return '비활성';
  if (value.includes('RESERVED') || value.includes('예약')) return '예약';

  return getSpaceStatusValue(space) || '-';
}

function statusClass(space: ParkingSpaceMapItem) {
  const value = getNormalizedStatus(space);

  if (value.includes('EXITED_UNPAID')) return 'border-red-500 bg-red-50';
  if (value.includes('TENANT_VISIT_GRACE')) return 'border-sky-500 bg-sky-50';
  if (value.includes('PAID_EXIT_PENDING') || value.includes('PAYMENT_GRACE_EXPIRED')) return 'border-red-500 bg-red-50';
  if (value.includes('VIOLATION') || value.includes('위반')) return 'border-red-500 bg-red-50';
  if (value.includes('UNREGISTERED') || value.includes('미등록')) return 'border-red-500 bg-red-50';
  if (value.includes('REGISTERED') || value.includes('등록')) return 'border-emerald-300 bg-emerald-50';
  if (value.includes('OCCUPIED') || value.includes('입차')) return 'border-amber-300 bg-amber-50';
  if (
    value.includes('FAULT') ||
    value.includes('ERROR') ||
    value.includes('MAINTENANCE') ||
    value.includes('장애') ||
    value.includes('점검')
  ) {
    return 'border-slate-400 bg-slate-100';
  }
  if (value.includes('EMPTY') || value.includes('AVAILABLE') || value.includes('출차')) {
    return 'border-slate-200 bg-white';
  }

  return 'border-slate-200 bg-white';
}

function statusLabelClass(space: ParkingSpaceMapItem) {
  const value = getNormalizedStatus(space);
  if (value === 'MANUAL_AVAILABLE') return 'bg-emerald-600 text-white';
  if (value === 'MANUAL_OCCUPIED') return 'bg-blue-600 text-white';

  if (value.includes('EXITED_UNPAID')) return 'bg-red-600 text-white';
  if (value.includes('TENANT_VISIT_GRACE')) return 'bg-sky-600 text-white';
  if (value.includes('PAID_EXIT_PENDING') || value.includes('PAYMENT_GRACE_EXPIRED')) return 'bg-red-600 text-white';
  if (value.includes('VIOLATION') || value.includes('위반')) return 'bg-red-600 text-white';
  if (value.includes('UNREGISTERED') || value.includes('미등록')) return 'bg-red-600 text-white';
  if (value.includes('REGISTERED') || value.includes('등록')) return 'bg-emerald-600 text-white';
  if (value.includes('OCCUPIED') || value.includes('입차')) return 'bg-amber-500 text-white';
  if (
    value.includes('FAULT') ||
    value.includes('ERROR') ||
    value.includes('MAINTENANCE') ||
    value.includes('장애') ||
    value.includes('점검')
  ) {
    return 'bg-slate-700 text-white';
  }
  if (value.includes('DISABLED') || value.includes('비활성')) return 'bg-slate-500 text-white';
  if (value.includes('RESERVED') || value.includes('예약')) return 'bg-blue-600 text-white';
  if (value.includes('EMPTY') || value.includes('AVAILABLE') || value.includes('출차')) {
    return 'bg-white text-slate-700 ring-1 ring-inset ring-slate-200';
  }

  return 'bg-white text-slate-700 ring-1 ring-inset ring-slate-200';
}

function getActiveSession(space: ParkingSpaceMapItem) {
  const raw = asRecord(space);
  return asRecord(
    raw.activeSession ??
      raw.session ??
      raw.parkingSession ??
      raw.currentSession ??
      {},
  );
}

function getVehiclePlate(space: ParkingSpaceMapItem) {
  const raw = asRecord(space);
  const session = getActiveSession(space);

  return (
    str(session.plateNumber) ||
    str(session.vehiclePlate) ||
    str(session.vehicleNumber) ||
    str(session.carNumber) ||
    str(raw.plateNumber) ||
    str(raw.vehiclePlate) ||
    '-'
  );
}

function getContact(space: ParkingSpaceMapItem) {
  const raw = asRecord(space);
  const session = getActiveSession(space);

  return (
    str(session.phone) ||
    str(session.phoneNumber) ||
    str(session.contact) ||
    str(session.contactPhone) ||
    str(session.driverPhone) ||
    str(session.mobile) ||
    str(raw.phone) ||
    str(raw.phoneNumber) ||
    str(raw.contact) ||
    '-'
  );
}

function getEntryTime(space: ParkingSpaceMapItem) {
  const raw = asRecord(space);
  const session = getActiveSession(space);

  return (
    str(session.entryTime) ||
    str(session.enteredAt) ||
    str(session.startedAt) ||
    str(raw.entryTime) ||
    str(raw.enteredAt) ||
    null
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

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

function isRegistrationRequired(space: ParkingSpaceMapItem) {
  const value = getNormalizedStatus(space);
  return value.includes('UNREGISTERED') || value.includes('미등록');
}

function getBasePath(role?: ConsoleRole) {
  if (role === 'admin') return '/admin';
  if (role === 'manager') return '/manager';
  return '/operator';
}

function getRegistrationHref(role: ConsoleRole | undefined, space: ParkingSpaceMapItem) {
  const code = getSpaceCode(space);
  return `${getBasePath(role)}/parking/sessions?space=${encodeURIComponent(code)}&action=register`;
}

function goToRegistration(role: ConsoleRole | undefined, space: ParkingSpaceMapItem) {
  if (typeof window === 'undefined') return;
  window.location.href = getRegistrationHref(role, space);
}

const STATUS_LEGEND = [
  { label: '출차', className: 'border-slate-200 bg-white text-slate-700 ring-1 ring-inset ring-slate-200' },
  { label: '입차', className: 'bg-amber-500 text-white' },
  { label: '입차 등록', className: 'bg-emerald-600 text-white' },
  { label: '입차 미등록', className: 'bg-red-600 text-white' },
  { label: '출차 후 미결제', className: 'bg-red-600 text-white' },
  { label: '방문 확인/출차 유예 중', className: 'bg-sky-600 text-white' },
  { label: '결제 후 미출차', className: 'bg-red-600 text-white' },
  { label: '점검/장애', className: 'bg-slate-700 text-white' },
];

export function GridPage({
  role = 'operator',
  title = 'Grid',
  description = '주차면 상태를 그리드 형식으로 확인합니다.',
}: Props) {
  const { socket } = useRealtime();
  const { session } = useAuth();

  const [data, setData] = useState<GridData>({
    parkingLots: [],
    spaces: [],
  });
  const [region, setRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [parkingLotId, setParkingLotId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quickFilter, setQuickFilter] = useState<QuickGridFilter>({
    mode: '',
    target: '',
  });
  const [manualAction, setManualAction] = useState<ManualParkingAction>('entry');
  const [manualTarget, setManualTarget] = useState<ManualParkingTarget | null>(null);

  const accessToken = session?.accessToken;
  const pageTitle =
    title === 'Admin Grid'
      ? '관리자 그리드'
      : title === 'Manager Grid'
        ? '매니저 그리드'
        : title === 'Grid'
          ? '그리드'
          : title;

  const load = useCallback(async () => {
    if (!accessToken) return;

    setLoading(true);
    setError('');

    try {
      const result = await apiFetch<LiveResponse>('/parking-monitor/spaces/live', {
        accessToken,
      });
      setData(mapLiveResponseToGridData(result));
    } catch (error) {
      setError(
        error instanceof Error ? error.message : '그리드 데이터를 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lotId = params.get('lotId');
    const sectionIdFromQuery = params.get('sectionId');
    const searchFromQuery = params.get('q');

    setQuickFilter({
      mode: normalizeQuickValue(params.get('mode')),
      target: normalizeQuickValue(params.get('target')),
    });

    if (lotId) {
      setParkingLotId(lotId);
    }

    if (sectionIdFromQuery) {
      setSectionId(sectionIdFromQuery);
    }

    if (searchFromQuery) {
      setSearch(searchFromQuery);
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    const update = (spaceId: string, status: string) => {
      setData((prev) => ({
        ...prev,
        spaces: prev.spaces.map((space) =>
          space.id === spaceId
            ? {
                ...space,
                status,
                occupancyState: status,
              }
            : space,
        ),
      }));
    };

    socket.on('parking.entry', (payload) => {
      update(payload.parkingSpaceId, 'OCCUPIED');
    });

    socket.on('parking.exit', (payload) => {
      update(payload.parkingSpaceId, 'EMPTY');
    });

    socket.on('parking.violation', (payload) => {
      update(payload.parkingSpaceId, 'VIOLATION');
    });

    return () => {
      socket.off('parking.entry');
      socket.off('parking.exit');
      socket.off('parking.violation');
    };
  }, [socket]);

  const regions = useMemo(() => {
    const values = new Set<string>();

    data.parkingLots.forEach((lot) => {
      const value = getRegion(lot);
      if (value !== 'All Regions') values.add(value);
    });

    data.spaces.forEach((space) => {
      const value = getSpaceRegion(space, data.parkingLots);
      if (value !== 'All Regions') values.add(value);
    });

    return Array.from(values).sort();
  }, [data.parkingLots, data.spaces]);

  const districts = useMemo(() => {
    const values = new Set<string>();

    data.parkingLots.forEach((lot) => {
      if (region && getRegion(lot) !== region) return;

      const value = getDistrict(lot);
      if (value !== 'All Districts') values.add(value);
    });

    data.spaces.forEach((space) => {
      if (region && getSpaceRegion(space, data.parkingLots) !== region) return;

      const value = getSpaceDistrict(space, data.parkingLots);
      if (value !== 'All Districts') values.add(value);
    });

    return Array.from(values).sort();
  }, [data.parkingLots, data.spaces, region]);

  const lots = useMemo(() => {
    return data.parkingLots.filter((lot) => {
      if (region && getRegion(lot) !== region) return false;
      if (district && getDistrict(lot) !== district) return false;
      return true;
    });
  }, [data.parkingLots, region, district]);

  const sections = useMemo(() => {
    const map = new Map<string, string>();

    data.spaces.forEach((space) => {
      if (region && getSpaceRegion(space, data.parkingLots) !== region) return;
      if (district && getSpaceDistrict(space, data.parkingLots) !== district) return;
      if (parkingLotId && space.lotId !== parkingLotId) return;
      if (!space.sectionId) return;

      map.set(space.sectionId, getSpaceSectionName(space));
    });

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.parkingLots, data.spaces, parkingLotId, region, district]);

  const filteredSpaces = useMemo(() => {
    const q = search.trim().toLowerCase();

    return data.spaces.filter((space) => {
      if (region && getSpaceRegion(space, data.parkingLots) !== region) {
        return false;
      }

      if (district && getSpaceDistrict(space, data.parkingLots) !== district) {
        return false;
      }

      if (parkingLotId && space.lotId !== parkingLotId) {
        return false;
      }

      if (sectionId && space.sectionId !== sectionId) {
        return false;
      }

      const quickMode = normalizeQuickValue(quickFilter.mode);
      const quickTarget = normalizeQuickValue(quickFilter.target);

      if (quickMode && quickMode !== 'all') {
        const isManual = isManualLotSpace(space);

        if (quickMode === 'manual' && !isManual) {
          return false;
        }

        if (quickMode === 'sensor' && isManual) {
          return false;
        }
      }

      if (quickTarget && !matchesQuickGridTarget(space, quickTarget)) {
        return false;
      }

      if (q) {
        const lotName = getSpaceLotName(space, data.parkingLots);
        const sectionName = getSpaceSectionName(space);

        return (
          getSpaceCode(space).toLowerCase().includes(q) ||
          getVehiclePlate(space).toLowerCase().includes(q) ||
          getContact(space).toLowerCase().includes(q) ||
          lotName.toLowerCase().includes(q) ||
          sectionName.toLowerCase().includes(q) ||
          getSpaceStatusValue(space).toLowerCase().includes(q) ||
          statusLabel(space).toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [data.parkingLots, data.spaces, parkingLotId, quickFilter, search, sectionId, region, district]);

  function renderManualOperationButtons(space: ParkingSpaceMapItem) {
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
    setManualTarget(getManualTargetFromSpace(space));
  }

  function closeManualModal() {
    setManualTarget(null);
  }

  const summary = useMemo(() => {
    const occupied = filteredSpaces.filter((space) => {
      const value = getNormalizedStatus(space);
      return value.includes('OCCUPIED') || value.includes('입차');
    });
    const violations = filteredSpaces.filter((space) => {
      const value = getNormalizedStatus(space);
      return (
        value.includes('VIOLATION') ||
        value.includes('EXITED_UNPAID') ||
        value.includes('TENANT_VISIT') ||
    value.includes('PAID_EXIT_PENDING') ||
        value.includes('위반')
      );
    });
    const unregistered = filteredSpaces.filter((space) => {
      const value = getNormalizedStatus(space);
      return value.includes('UNREGISTERED') || value.includes('미등록');
    });

    return {
      total: filteredSpaces.length,
      occupied: occupied.length,
      violations: violations.length,
      unregistered: unregistered.length,
    };
  }, [filteredSpaces]);

  return (
    <main className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{pageTitle}</h1>
          <p className="text-sm text-slate-500">{description}</p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          className="rounded-2xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          새로고침
        </button>
      </div>

      {role ? null : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {(quickFilter.mode || quickFilter.target) ? (
        <div className="dashboard-quick-filter-banner flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="font-black">대시보드 필터 적용 중</span>
            <span className="ml-2">{getQuickFilterTitle(quickFilter)}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setQuickFilter({ mode: '', target: '' });
              window.history.replaceState(null, '', window.location.pathname);
            }}
            className="rounded-xl bg-white px-3 py-2 text-xs font-black text-blue-700 shadow-sm"
          >
            필터 해제
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border bg-white p-4 text-sm text-slate-500">
          그리드 데이터를 불러오는 중...
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">주차면수</div>
          <div className="mt-2 text-3xl font-semibold">{summary.total}</div>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">입차면수</div>
          <div className="mt-2 text-3xl font-semibold">{summary.occupied}</div>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">미등록 건수</div>
          <div className="mt-2 text-3xl font-semibold text-red-600">
            {summary.unregistered}
          </div>
        </div>

        <div className="rounded-3xl border bg-white p-5">
          <div className="text-sm text-slate-500">위반 건수</div>
          <div className="mt-2 text-3xl font-semibold text-orange-600">
            {summary.violations}
          </div>
        </div>
      </section>

      <section className="grid gap-3 rounded-3xl border bg-white p-4 md:grid-cols-5">
        <select
          className="rounded-2xl border px-4 py-3 text-sm outline-none"
          value={region}
          onChange={(event) => {
            setRegion(event.target.value);
            setDistrict('');
            setParkingLotId('');
            setSectionId('');
          }}
        >
          <option value="">전체 시/도</option>
          {regions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          className="rounded-2xl border px-4 py-3 text-sm outline-none"
          value={district}
          onChange={(event) => {
            setDistrict(event.target.value);
            setParkingLotId('');
            setSectionId('');
          }}
        >
          <option value="">전체 시/군/구</option>
          {districts.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <select
          className="rounded-2xl border px-4 py-3 text-sm outline-none"
          value={parkingLotId}
          onChange={(event) => {
            setParkingLotId(event.target.value);
            setSectionId('');
          }}
        >
          <option value="">전체 주차장</option>
          {lots.map((lot) => (
            <option key={lot.id} value={lot.id}>
              {lot.name}
            </option>
          ))}
        </select>

        <select
          className="rounded-2xl border px-4 py-3 text-sm outline-none"
          value={sectionId}
          onChange={(event) => setSectionId(event.target.value)}
        >
          <option value="">전체 구역</option>
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.name}
            </option>
          ))}
        </select>

        <input
          className="rounded-2xl border px-4 py-3 text-sm outline-none"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="주차면, 차량 번호, 연락처, 상태 검색"
        />
      </section>

      <section className="rounded-3xl border bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
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
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7">
        {filteredSpaces.map((space) => {
          const registrationRequired =
            !isManualLotSpace(space) && isRegistrationRequired(space);

          return (
            <div
              key={space.id}
              role={registrationRequired ? 'button' : undefined}
              tabIndex={registrationRequired ? 0 : undefined}
              onClick={() => {
                if (registrationRequired) goToRegistration(role, space);
              }}
              onKeyDown={(event) => {
                if (!registrationRequired) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  goToRegistration(role, space);
                }
              }}
              className={[
                'rounded-2xl border p-3 text-left text-xs shadow-sm transition hover:shadow',
                registrationRequired ? 'cursor-pointer ring-1 ring-inset ring-red-200' : '',
                statusClass(space),
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{getSpaceCode(space)}</span>
                <span
                  className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${statusLabelClass(space)}`}
                >
                  {statusLabel(space)}
                </span>
              </div>

              <div className="mt-2 space-y-0.5 text-[11px] text-slate-500">
                <div>{getSpaceLotName(space, data.parkingLots)}</div>
                <div>{getSpaceSectionName(space)}</div>
                <div>차량 번호: {getVehiclePlate(space)}</div>
                <div>연락처: {getContact(space)}</div>
                <div>입차 시간: {formatDateTime(getEntryTime(space))}</div>

                <div className="grid-manual-action-buttons mt-3 flex flex-wrap gap-2">
                  {renderManualOperationButtons(space)}
                </div>
              </div>

              {registrationRequired ? (
                <div className="mt-3 inline-flex whitespace-nowrap rounded-xl bg-red-600 px-3 py-1.5 text-[11px] font-bold text-white">
                  주차 등록
                </div>
              ) : null}
            </div>
          );
        })}

        {!loading && filteredSpaces.length === 0 ? (
          <div className="col-span-full rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">
            표시할 주차면이 없습니다.
          </div>
        ) : null}
      </section>
      <ManualParkingSessionModal
        open={manualTarget != null}
        action={manualAction}
        target={manualTarget}
        accessToken={accessToken}
        onClose={closeManualModal}
        onSaved={load}
      />
    </main>
  );
}
