export type DashboardStatCard = {
  label: string;
  value: number | string;
  description?: string;
};

export type ApprovalItem = {
  id: string;
  type: 'MANAGER_APPROVAL' | 'OPERATOR_APPROVAL';
  applicantName: string;
  applicantEmail?: string | null;
  applicantPhone?: string | null;
  parkingLotName?: string | null;
  parkingSectionName?: string | null;
  status: string;
  createdAt: string;
};

export type FacilityLotItem = {
  id: string;
  name: string;
  code: string;
  region?: string | null;
  isActive: boolean;
  sectionCount: number;
  spaceCount: number;
};

export type FacilitySectionItem = {
  id: string;
  name: string;
  code: string;
  parkingLotName: string;
  isActive: boolean;
  spaceCount: number;
};

export type FacilitySpaceItem = {
  id: string;
  code: string;
  parkingLotName: string;
  sectionName: string;
  status: string;
  occupancyState?: string;
};

export type DeviceItem = {
  id: string;
  code: string;
  type: string;
  devEui?: string | null;
  lotName?: string | null;
  sectionName?: string | null;
  spaceCode?: string | null;
  status: string;
  batteryLevel?: number | null;
  batteryVoltage?: number | null;
  lastSeenAt?: string | null;
};

export type DeviceFaultItem = {
  id: string;
  deviceCode: string;
  lotName?: string | null;
  sectionName?: string | null;
  severity: string;
  status: string;
  reason: string;
  createdAt: string;
};

export type FeePolicyItem = {
  id: string;
  name: string;
  code: string;
  region?: string | null;
  lotName?: string | null;
  baseMinutes: number;
  baseFee: number;
  unitMinutes: number;
  unitFee: number;
  isActive: boolean;
};

export type UserListItem = {
  id: string;
  name: string;
  email?: string | null;
  companyName?: string | null;
  phone?: string | null;
  roleLabel: string;
  status?: string | null;
  isApproved?: boolean | null;
  approvedAt?: string | null;
};

export type SystemStatusItem = {
  service: string;
  status: string;
  detail?: string;
  updatedAt?: string;
  responseTimeMs?: number;
};

export type CertificateStatusItem = {
  name: string;
  host: string;
  validTo: string | null;
  daysRemaining: number | null;
  status: string;
  detail: string;
};

export type SystemStatusPageData = {
  services: SystemStatusItem[];
  certificates: CertificateStatusItem[];
};