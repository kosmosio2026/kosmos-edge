import { getSession } from '@/lib/session';
import { adminBackendCandidates } from '@/lib/admin-backend-adapters';
import { tryCandidateRequest } from '@/lib/server-admin-request';
import {
  normalizeApprovals,
  normalizeDashboardStats,
  normalizeDeviceFaults,
  normalizeDevices,
  normalizeFeePolicies,
  normalizeLots,
  normalizeScopeOptions,
  normalizeSections,
  normalizeSpaces,
  normalizeSystemStatuses,
  normalizeUserDetail,
  normalizeUsers,
} from '@/lib/admin-normalizers';
import { getDashboardStats, getSystemStatuses } from '@/lib/admin-api';
import type { SystemStatusPageData } from '@/types/admin';

async function getAccessToken() {
  const session = await getSession();
  return session?.accessToken ?? null;
}

export async function getManagerApprovalItems() {
  const accessToken = await getAccessToken();
  if (!accessToken) return [];
  try {
    const data = await tryCandidateRequest({
      accessToken,
      candidates: adminBackendCandidates.approvals.managerList,
      method: 'GET',
    });
    return normalizeApprovals(data, 'MANAGER_APPROVAL');
  } catch {
    return [];
  }
}

export async function getOperatorApprovalItems() {
  const accessToken = await getAccessToken();
  if (!accessToken) return [];
  try {
    const data = await tryCandidateRequest({
      accessToken,
      candidates: adminBackendCandidates.approvals.operatorList,
      method: 'GET',
    });
    return normalizeApprovals(data, 'OPERATOR_APPROVAL');
  } catch {
    return [];
  }
}

export async function getLotItems() {
  const accessToken = await getAccessToken();
  if (!accessToken) return [];
  try {
    const data = await tryCandidateRequest({
      accessToken,
      candidates: adminBackendCandidates.facilities.lots.list,
      method: 'GET',
    });
    return normalizeLots(data);
  } catch {
    return [];
  }
}

export async function getSectionItems() {
  const accessToken = await getAccessToken();
  if (!accessToken) return [];
  try {
    const data = await tryCandidateRequest({
      accessToken,
      candidates: adminBackendCandidates.facilities.sections.list,
      method: 'GET',
    });
    return normalizeSections(data);
  } catch {
    return [];
  }
}

export async function getSpaceItems() {
  const accessToken = await getAccessToken();
  if (!accessToken) return [];
  try {
    const data = await tryCandidateRequest({
      accessToken,
      candidates: adminBackendCandidates.facilities.spaces.list,
      method: 'GET',
    });
    return normalizeSpaces(data);
  } catch {
    return [];
  }
}

export async function getDeviceItems() {
  const accessToken = await getAccessToken();
  if (!accessToken) return [];
  try {
    const data = await tryCandidateRequest({
      accessToken,
      candidates: ['/devices', '/devices/list', '/device/list'],
      method: 'GET',
    });
    return normalizeDevices(data);
  } catch {
    return [];
  }
}

export async function getDeviceFaultItems() {
  const accessToken = await getAccessToken();
  if (!accessToken) return [];
  try {
    const data = await tryCandidateRequest({
      accessToken,
      candidates: adminBackendCandidates.deviceFaults.list,
      method: 'GET',
    });
    return normalizeDeviceFaults(data);
  } catch {
    return [];
  }
}

export async function getFeePolicyItems() {
  const accessToken = await getAccessToken();
  if (!accessToken) return [];
  try {
    const data = await tryCandidateRequest({
      accessToken,
      candidates: adminBackendCandidates.feePolicies.list,
      method: 'GET',
    });
    return normalizeFeePolicies(data);
  } catch {
    return [];
  }
}

export async function getMemberItems() {
  const accessToken = await getAccessToken();
  if (!accessToken) return [];
  try {
    const data = await tryCandidateRequest({
      accessToken,
      candidates: adminBackendCandidates.users.members,
      method: 'GET',
    });
    return normalizeUsers(data, 'MEMBER');
  } catch {
    return [];
  }
}

export async function getVisitorItems() {
  const accessToken = await getAccessToken();
  if (!accessToken) return [];
  try {
    const data = await tryCandidateRequest({
      accessToken,
      candidates: adminBackendCandidates.users.visitors,
      method: 'GET',
    });
    return normalizeUsers(data, 'VISITOR');
  } catch {
    return [];
  }
}

export async function getDashboardStatItems() {
  const accessToken = await getAccessToken();
  if (!accessToken) return getDashboardStats();

  try {
    const [statsRaw, statusesRaw] = await Promise.all([
      tryCandidateRequest({
        accessToken,
        candidates: ['/dashboard/overview', '/admin/dashboard', '/operator/dashboard'],
        method: 'GET',
      }),
      tryCandidateRequest({
        accessToken,
        candidates: ['/system/status'],
        method: 'GET',
      }),
    ]);

    return {
      stats: normalizeDashboardStats(statsRaw),
      statuses: normalizeSystemStatuses(statusesRaw),
    };
  } catch {
    return {
      stats: await getDashboardStats(),
      statuses: await getSystemStatuses(),
    };
  }
}

export async function getUserDetailItem(id: string) {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  try {
    const data = await tryCandidateRequest({
      accessToken,
      candidates: adminBackendCandidates.users.detail,
      method: 'GET',
      pathParams: { id },
    });
    return normalizeUserDetail(data);
  } catch {
    return null;
  }
}

export async function getScopePickerOptions() {
  const [lots, sections] = await Promise.all([getLotItems(), getSectionItems()]);
  return normalizeScopeOptions({ lots, sections });
}

export async function getSystemStatusPageData(): Promise<SystemStatusPageData> {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return {
      services: [],
      certificates: [],
    };
  }

  try {
    const data = await tryCandidateRequest({
      accessToken,
      candidates: ['/system/status'],
      method: 'GET',
    });

    const source = data as any;

    return {
      services: Array.isArray(source?.services) ? source.services : [],
      certificates: Array.isArray(source?.certificates)
        ? source.certificates
        : [],
    };
  } catch {
    return {
      services: [],
      certificates: [],
    };
  }
}