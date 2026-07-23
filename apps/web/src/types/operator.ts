import type { AuthUser } from '@/types/auth';

export type UserRole = 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'MEMBER' | 'VISITOR';

export type SessionPayload = {
  accessToken: string;
  user: AuthUser;
};

export type ParkingLotMapItem = {
  id: string;
  name: string;
  code: string;
  lat: number | null;
  lng: number | null;
  summary: {
    totalSpaces: number;
    availableSpaces: number;
    occupiedSpaces: number;
    activeSessions: number;
  };
  operation: {
    status: string;
    openFaultCount: number;
  };
};

export type ParkingSpaceMapItem = {
  id: string;
  code: string;
  type?: string | null;
  status: string;
  occupancyState:
    | 'EMPTY'
    | 'OCCUPIED_REGISTERED'
    | 'OCCUPIED_UNREGISTERED'
    | 'VIOLATION'
    | string;
  lotId: string;
  lotName: string;
  lotCode?: string | null;
  operationMode?: string | null;
  sectionId: string;
  sectionName: string;
  lat: number | null;
  lng: number | null;
  widthMeter: number;
  heightMeter: number;
  rotationDeg: number;
  labelVisible: boolean;
  isMyRecentSpace: boolean;
  activeSession?: {
    id?: string;
    sessionNo?: string | null;
    plateNumber?: string | null;
    entryTime?: string | null;
    exitTime?: string | null;
    entrySource?: string | null;
    exitSource?: string | null;
    manualEntryAt?: string | null;
    manualExitAt?: string | null;
    isRegistered?: boolean | null;
    registrationStatus?: string | null;
    paymentStatus?: string | null;
    paymentReason?: string | null;
    displayStatus?: string | null;
    visitTenantId?: string | null;
    visitTenantName?: string | null;
    visitTenantCode?: string | null;
    tenantConfirmedAt?: string | null;
    tenantGraceUntil?: string | null;
    tenantGraceExpired?: boolean | null;
    tenantCoveredAmount?: number | null;
    accruedFeeAmount?: number | null;
    accruedFeeCurrency?: string | null;
    longParkingAlert?: boolean | null;
    unregisteredOverdue?: boolean | null;
    paymentGraceExpired?: boolean | null;
    additionalFeeRequired?: boolean | null;
  } | null;
};

export type OperatorMapResponse = {
  parkingLots: ParkingLotMapItem[];
  spaces: ParkingSpaceMapItem[];
};

export type SpaceRegisterPayload = {
  parkingSpaceId: string;
};

export type OperatorEventLogItem = {
  id: string;
  level: 'info' | 'warn' | 'danger';
  message: string;
  createdAt: string;
};

export type OperatorQuickAction =
  | 'register'
  | 'entry'
  | 'exit'
  | 'collect'
  | 'fault';

export type OperatorFilters = {
  parkingLotId: string;
  sectionId: string;
  search: string;
  viewMode: 'map' | 'grid';
};