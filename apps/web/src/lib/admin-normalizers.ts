import type {
  ApprovalItem,
  DashboardStatCard,
  DeviceFaultItem,
  DeviceItem,
  FacilityLotItem,
  FacilitySectionItem,
  FacilitySpaceItem,
  FeePolicyItem,
  SystemStatusItem,
  UserListItem,
} from '@/types/admin';

function arr<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (value && typeof value === 'object') {
    const maybe = value as Record<string, unknown>;

    if (Array.isArray(maybe.items)) return maybe.items as T[];
    if (Array.isArray(maybe.data)) return maybe.data as T[];
    if (Array.isArray(maybe.results)) return maybe.results as T[];

    if (
      maybe.data &&
      typeof maybe.data === 'object' &&
      Array.isArray((maybe.data as { items?: unknown }).items)
    ) {
      return (maybe.data as { items: T[] }).items;
    }
  }

  return [];
}

function str(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }

  return '';
}

function optionalStr(...values: unknown[]): string | undefined {
  const value = str(...values);
  return value || undefined;
}

function nullableStr(...values: unknown[]): string | null {
  const value = str(...values);
  return value || null;
}

function bool(...values: unknown[]): boolean {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (typeof value === 'number') return value !== 0;
  }

  return false;
}

function num(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;

    if (
      typeof value === 'string' &&
      value.trim() &&
      !Number.isNaN(Number(value))
    ) {
      return Number(value);
    }
  }

  return 0;
}

function nested(obj: unknown, path: Array<string | number>): unknown {
  let current = obj;

  for (const key of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }

  return current;
}

export function normalizeApprovals(
  raw: unknown,
  type: 'MANAGER_APPROVAL' | 'OPERATOR_APPROVAL',
): ApprovalItem[] {
  return arr<any>(raw).map((item, index) => ({
    id: str(item.id, item.requestId, `approval-${index}`),
    type,
    applicantName: str(
      item.applicantName,
      nested(item, ['user', 'name']),
      nested(item, ['applicant', 'name']),
      'Unknown',
    ),
    applicantEmail: nullableStr(
      item.applicantEmail,
      nested(item, ['user', 'email']),
      nested(item, ['applicant', 'email']),
    ),
    parkingLotName: nullableStr(
      item.parkingLotName,
      nested(item, ['parkingLot', 'name']),
      nested(item, ['lot', 'name']),
    ),
    parkingSectionName: nullableStr(
      item.parkingSectionName,
      nested(item, ['parkingSection', 'name']),
      nested(item, ['section', 'name']),
    ),
    status: str(item.status, 'PENDING'),
    createdAt: str(item.createdAt, item.requestedAt, item.created_at, '-'),
  }));
}

export function normalizeLots(raw: unknown): FacilityLotItem[] {
  return arr<any>(raw).map((item, index) => ({
    id: str(item.id, `lot-${index}`),
    name: str(item.name, item.title, '-'),
    code: str(item.code, item.lotCode, '-'),
    region: nullableStr(item.region, item.city, item.area),
    isActive: bool(item.isActive, item.active, item.status === 'ACTIVE'),
    sectionCount: num(
      item.sectionCount,
      item.sectionsCount,
      nested(item, ['_count', 'sections']),
    ),
    spaceCount: num(
      item.spaceCount,
      item.spacesCount,
      nested(item, ['_count', 'spaces']),
    ),
  }));
}

export function normalizeSections(raw: unknown): FacilitySectionItem[] {
  return arr<any>(raw).map((item, index) => ({
    id: str(item.id, `section-${index}`),
    name: str(item.name, '-'),
    code: str(item.code, '-'),
    parkingLotName: str(
      item.parkingLotName,
      nested(item, ['parkingLot', 'name']),
      nested(item, ['lot', 'name']),
      '-',
    ),
    isActive: bool(item.isActive, item.active, item.status === 'ACTIVE'),
    spaceCount: num(
      item.spaceCount,
      item.spacesCount,
      nested(item, ['_count', 'spaces']),
    ),
  }));
}

export function normalizeSpaces(raw: unknown): FacilitySpaceItem[] {
  return arr<any>(raw).map((item, index) => ({
    id: str(item.id, `space-${index}`),
    code: str(item.code, item.spaceCode, '-'),
    parkingLotName: str(
      item.parkingLotName,
      nested(item, ['section', 'parkingLot', 'name']),
      nested(item, ['parkingLot', 'name']),
      '-',
    ),
    sectionName: str(item.sectionName, nested(item, ['section', 'name']), '-'),
    status: str(item.status, 'UNKNOWN'),
    occupancyState: optionalStr(
      item.occupancyState,
      item.currentState,
      nested(item, ['summary', 'occupancyState']),
    ),
  }));
}

export function normalizeDevices(raw: unknown): DeviceItem[] {
  return arr<any>(raw).map((item, index) => ({
    id: str(item.id, `device-${index}`),
    code: str(item.code, item.deviceCode, item.sensorCode, '-'),
    type: str(item.type, item.deviceType, 'DEVICE'),
    lotName: nullableStr(
      item.lotName,
      nested(item, ['parkingLot', 'name']),
      nested(item, ['parkingSpace', 'section', 'parkingLot', 'name']),
    ),
    sectionName: nullableStr(
      item.sectionName,
      nested(item, ['parkingSection', 'name']),
      nested(item, ['parkingSpace', 'section', 'name']),
    ),
    spaceCode: nullableStr(
      item.spaceCode,
      nested(item, ['parkingSpace', 'code']),
    ),
    status: str(item.status, 'UNKNOWN'),
    lastSeenAt: nullableStr(item.lastSeenAt, item.updatedAt),
  }));
}

export function normalizeDeviceFaults(raw: unknown): DeviceFaultItem[] {
  return arr<any>(raw).map((item, index) => ({
    id: str(item.id, `fault-${index}`),
    deviceCode: str(
      item.deviceCode,
      nested(item, ['device', 'code']),
      nested(item, ['sensorDevice', 'code']),
      '-',
    ),
    lotName: nullableStr(
      item.lotName,
      nested(item, [
        'sensorDevice',
        'parkingSpace',
        'section',
        'parkingLot',
        'name',
      ]),
    ),
    sectionName: nullableStr(
      item.sectionName,
      nested(item, ['sensorDevice', 'parkingSpace', 'section', 'name']),
    ),
    severity: str(item.severity, item.level, 'MEDIUM'),
    status: str(item.status, 'OPEN'),
    reason: str(item.reason, item.message, item.title, '-'),
    createdAt: str(item.createdAt, item.reportedAt, '-'),
  }));
}

export function normalizeFeePolicies(raw: unknown): FeePolicyItem[] {
  return arr<any>(raw).map((item, index) => ({
    id: str(item.id, `fee-${index}`),
    name: str(item.name, '-'),
    code: str(item.code, item.policyCode, '-'),
    lotName: nullableStr(item.lotName, nested(item, ['parkingLot', 'name'])),
    baseMinutes: num(item.baseMinutes, item.baseMinute, item.defaultMinutes),
    baseFee: num(item.baseFee, item.defaultFee),
    unitMinutes: num(item.unitMinutes, item.stepMinutes),
    unitFee: num(item.unitFee, item.stepFee),
    isActive: bool(item.isActive, item.active, item.status === 'ACTIVE'),
  }));
}

export function normalizeUsers(raw: unknown, roleLabel: string): UserListItem[] {
  return arr<any>(raw).map((item, index) => ({
    id: str(item.id, item.userId, `user-${index}`),
    name: str(item.name, item.fullName, '-'),
    email: nullableStr(item.email),
    phone: nullableStr(item.phone, item.mobile),
    roleLabel: str(item.roleLabel, item.role, nested(item, ['roles', 0]), roleLabel),
    status: nullableStr(item.status, item.userStatus),
  }));
}

export function normalizeSystemStatuses(raw: unknown): SystemStatusItem[] {
  return arr<any>(raw).map((item, index) => ({
    service: str(item.service, item.name, `service-${index}`),
    status: str(item.status, 'UNKNOWN'),
    detail: optionalStr(item.detail, item.message, item.description),
    updatedAt: optionalStr(item.updatedAt, item.checkedAt),
  }));
}

export function normalizeDashboardStats(raw: unknown): DashboardStatCard[] {
  const source =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  return [
    {
      label: '전체 주차장',
      value: num(source.totalLots, source.lotCount, nested(source, ['summary', 'lots'])),
      description: '운영 중 주차장 수',
    },
    {
      label: '전체 주차면',
      value: num(source.totalSpaces, source.spaceCount, nested(source, ['summary', 'spaces'])),
      description: '활성 주차면 수',
    },
    {
      label: '오늘 입차',
      value: num(source.todayEntries, nested(source, ['today', 'entries'])),
      description: '오늘 누적 입차',
    },
    {
      label: '오늘 출차',
      value: num(source.todayExits, nested(source, ['today', 'exits'])),
      description: '오늘 누적 출차',
    },
    {
      label: '미등록 점유',
      value: num(
        source.unregisteredOccupied,
        nested(source, ['parking', 'unregistered']),
      ),
      description: '현장 확인 필요',
    },
    {
      label: '장애 건수',
      value: num(source.openFaults, nested(source, ['devices', 'openFaults'])),
      description: 'OPEN / IN_PROGRESS',
    },
  ];
}

export function normalizeUserDetail(raw: unknown) {
  const item =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  return {
    id: str(item.id, item.userId),
    name: str(item.name, item.fullName),
    email: nullableStr(item.email),
    phone: nullableStr(item.phone, item.mobile),
    roles: arr<string>(item.roles),
    status: nullableStr(item.status, item.userStatus),
    scopes: {
      parkingLotIds: arr<string>(
        nested(item, ['scopes', 'parkingLotIds']) ?? item.parkingLotIds,
      ),
      parkingSectionIds: arr<string>(
        nested(item, ['scopes', 'parkingSectionIds']) ??
          item.parkingSectionIds,
      ),
    },
  };
}

export function normalizeScopeOptions(params: {
  lots: FacilityLotItem[];
  sections: FacilitySectionItem[];
}) {
  return {
    lots: params.lots.map((lot) => ({
      id: lot.id,
      name: lot.name,
    })),
    sections: params.sections.map((section) => ({
      id: section.id,
      name: `${section.parkingLotName} · ${section.name}`,
      parkingLotName: section.parkingLotName,
    })),
  };
}