import { apiFetch } from './api-client';

export type TableQuery = {
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  status?: string;
  parkingLotId?: string;
  parkingSectionId?: string;
};

function buildQuery(query: TableQuery = {}) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params.set(key, String(value));
  });

  const text = params.toString();
  return text ? `?${text}` : '';
}

export async function fetchDashboardSummary(accessToken: string) {
  return apiFetch('/analytics/dashboard-summary', { accessToken });
}

export async function fetchParkingLots(accessToken: string) {
  return apiFetch('/facilities/lots', { accessToken });
}

export async function fetchParkingSections(accessToken: string) {
  return apiFetch('/facilities/sections', { accessToken });
}

export async function fetchParkingSpaces(accessToken: string) {
  return apiFetch('/facilities/spaces', { accessToken });
}

export async function fetchDevices(accessToken: string) {
  return apiFetch('/devices/list', { accessToken });
}

export async function fetchDeviceFaults(accessToken: string) {
  return apiFetch('/devices/faults', { accessToken });
}

export async function fetchDisplayBoards(accessToken: string) {
  return apiFetch('/display/controllers', { accessToken });
}

export async function fetchDisplayBoard(
  accessToken: string,
  parkingLotId: string,
) {
  return apiFetch(`/display/controllers/${parkingLotId}`, { accessToken });
}

export async function fetchOperatorSummary(
  accessToken: string,
  parkingLotId?: string,
) {
  return apiFetch(`/operator/dashboard/summary${buildQuery({ parkingLotId })}`, {
    accessToken,
  });
}

export async function fetchOperatorLiveSpaces(
  accessToken: string,
  parkingLotId?: string,
) {
  return apiFetch(`/operator/dashboard/live-spaces${buildQuery({ parkingLotId })}`, {
    accessToken,
  });
}

export async function fetchViolations(accessToken: string) {
  return apiFetch('/enforcement/violations', { accessToken });
}

export async function fetchRbacMatrix(accessToken: string) {
  return apiFetch('/rbac/admin-page/matrix', { accessToken });
}

export async function fetchSystemHealth(accessToken: string) {
  return apiFetch('/health', { accessToken });
}

export async function fetchSystemStatus(accessToken: string) {
  return apiFetch('/system/status', { accessToken });
}

/**
 * Approval queues
 * Compatible with the current Admin API routes:
 * /api/admin/approvals/by-kind/[kind]
 */
export async function fetchManagerApprovals(
  query: TableQuery = {},
  accessToken?: string,
) {
  return apiFetch(`/approval/admin/pending-managers${buildQuery(query)}`, {
    accessToken,
  });
}

export async function fetchOperatorApprovals(
  query: TableQuery = {},
  accessToken?: string,
) {
  return apiFetch(`/approval/manager/pending-operators${buildQuery(query)}`, {
    accessToken,
  });
}

/**
 * Legacy aliases used by older pages.
 */
export async function fetchPendingManagers(accessToken: string) {
  return fetchManagerApprovals({}, accessToken);
}

export async function fetchPendingOperators(accessToken: string) {
  return fetchOperatorApprovals({}, accessToken);
}

export async function reviewApprovalRequest(
  accessToken: string,
  requestId: string,
  status: 'APPROVED' | 'REJECTED',
  reviewedNote?: string,
  scopes?: {
    parkingLotIds?: string[];
    parkingSectionIds?: string[];
    parkingSpaceIds?: string[];
  },
) {
  return apiFetch(`/approval/${requestId}/review`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify({
      status,
      reviewedNote,
      scopes,
    }),
  });
}

export async function createManagerApprovalRequest(
  accessToken: string,
  body: Record<string, unknown>,
) {
  return apiFetch('/approval/manager-request', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(body),
  });
}

export async function createOperatorApprovalRequest(
  accessToken: string,
  body: Record<string, unknown>,
) {
  return apiFetch('/approval/operator-request', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(body),
  });
}

export async function createParkingLot(
  accessToken: string,
  body: Record<string, unknown>,
) {
  return apiFetch('/facilities/lots', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(body),
  });
}

export async function updateParkingLot(
  accessToken: string,
  id: string,
  body: Record<string, unknown>,
) {
  return apiFetch(`/facilities/lots/${id}`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(body),
  });
}

export async function createParkingSection(
  accessToken: string,
  body: Record<string, unknown>,
) {
  return apiFetch('/facilities/sections', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(body),
  });
}

export async function updateParkingSection(
  accessToken: string,
  id: string,
  body: Record<string, unknown>,
) {
  return apiFetch(`/facilities/sections/${id}`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(body),
  });
}

export async function createParkingSpace(
  accessToken: string,
  body: Record<string, unknown>,
) {
  return apiFetch('/facilities/spaces', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(body),
  });
}

export async function updateParkingSpace(
  accessToken: string,
  id: string,
  body: Record<string, unknown>,
) {
  return apiFetch(`/facilities/spaces/${id}`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(body),
  });
}

export async function updateDeviceFault(
  accessToken: string,
  id: string,
  body: Record<string, unknown>,
) {
  return apiFetch(`/devices/faults/${id}`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(body),
  });
}

export async function fetchBillingSummary(accessToken: string) {
  return apiFetch('/billing/summary', { accessToken });
}

export async function fetchOutstanding(accessToken: string) {
  return apiFetch('/billing/outstanding', { accessToken });
}

export async function fetchSettlements(accessToken: string) {
  return apiFetch('/settlement', { accessToken });
}

export async function closeSettlement(
  accessToken: string,
  body: Record<string, unknown>,
) {
  return apiFetch('/settlement/close', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(body),
  });
}

export async function fetchParkingLotApprovals(
  params: any,
  accessToken: string,
) {
  return apiFetch('/approval/admin/pending-parking-lots', {
    method: 'GET',
    accessToken,
  });
}

export async function createParkingLotApprovalRequest(
  accessToken: string,
  body: {
    type: 'PARKING_LOT_ACCESS' | 'PARKING_LOT_CREATION';
    requestedParkingLotId?: string;
    requestedParkingLotName?: string;
    note?: string;
  },
) {
  return apiFetch('/approval/parking-lot-request', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(body),
  });
}