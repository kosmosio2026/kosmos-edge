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

export async function getDashboardStats(): Promise<DashboardStatCard[]> {
  return [
    { label: '전체 주차장', value: 12, description: '운영 중 주차장 수' },
    { label: '전체 주차면', value: 1284, description: '활성 주차면 수' },
    { label: '오늘 입차', value: 342, description: '오늘 누적 입차' },
    { label: '오늘 출차', value: 317, description: '오늘 누적 출차' },
    { label: '미등록 점유', value: 17, description: '현장 확인 필요' },
    { label: '장애 건수', value: 6, description: 'OPEN / IN_PROGRESS' },
  ];
}

export async function getManagerApprovals(): Promise<ApprovalItem[]> {
  return [
    {
      id: 'appr_mgr_1',
      type: 'MANAGER_APPROVAL',
      applicantName: 'Manager Park',
      applicantEmail: 'manager.park@example.com',
      parkingLotName: '판교 제1주차장',
      status: 'PENDING',
      createdAt: '2026-04-19 10:10',
    },
  ];
}

export async function getOperatorApprovals(): Promise<ApprovalItem[]> {
  return [
    {
      id: 'appr_op_1',
      type: 'OPERATOR_APPROVAL',
      applicantName: 'Operator Kim',
      applicantEmail: 'operator.kim@example.com',
      parkingLotName: '판교 제1주차장',
      parkingSectionName: 'A구역',
      status: 'PENDING',
      createdAt: '2026-04-19 10:20',
    },
  ];
}

export async function getLots(): Promise<FacilityLotItem[]> {
  return [
    {
      id: 'lot_1',
      name: '판교 제1주차장',
      code: 'PG-01',
      region: '성남',
      isActive: true,
      sectionCount: 5,
      spaceCount: 120,
    },
  ];
}

export async function getSections(): Promise<FacilitySectionItem[]> {
  return [
    {
      id: 'section_1',
      name: 'A구역',
      code: 'SEC-A',
      parkingLotName: '판교 제1주차장',
      isActive: true,
      spaceCount: 40,
    },
  ];
}

export async function getSpaces(): Promise<FacilitySpaceItem[]> {
  return [
    {
      id: 'space_1',
      code: 'A-01',
      parkingLotName: '판교 제1주차장',
      sectionName: 'A구역',
      status: 'ACTIVE',
      occupancyState: 'EMPTY',
    },
  ];
}

export async function getDevices(): Promise<DeviceItem[]> {
  return [
    {
      id: 'dev_1',
      code: 'SENSOR-001',
      type: 'SENSOR',
      lotName: '판교 제1주차장',
      sectionName: 'A구역',
      spaceCode: 'A-01',
      status: 'ACTIVE',
      lastSeenAt: '2026-04-19 11:12',
    },
  ];
}

export async function getDeviceFaults(): Promise<DeviceFaultItem[]> {
  return [
    {
      id: 'fault_1',
      deviceCode: 'SENSOR-009',
      lotName: '판교 제1주차장',
      sectionName: 'B구역',
      severity: 'HIGH',
      status: 'OPEN',
      reason: '신호 수신 불량',
      createdAt: '2026-04-19 10:05',
    },
  ];
}

export async function getFeePolicies(): Promise<FeePolicyItem[]> {
  return [
    {
      id: 'fee_1',
      name: '기본 요금제',
      code: 'FEE-BASE',
      lotName: '판교 제1주차장',
      baseMinutes: 30,
      baseFee: 2000,
      unitMinutes: 10,
      unitFee: 500,
      isActive: true,
    },
  ];
}

export async function getMembers(): Promise<UserListItem[]> {
  return [
    {
      id: 'member_1',
      name: '홍길동',
      email: 'member1@example.com',
      phone: '010-1111-2222',
      roleLabel: 'MEMBER',
      status: 'ACTIVE',
    },
  ];
}

export async function getVisitors(): Promise<UserListItem[]> {
  return [
    {
      id: 'visitor_1',
      name: '방문객',
      phone: '010-9999-0000',
      roleLabel: 'VISITOR',
      status: 'TEMPORARY',
    },
  ];
}

export async function getSystemStatuses(): Promise<SystemStatusItem[]> {
  return [
    {
      service: 'Backend API',
      status: 'UP',
      detail: '응답 정상',
      updatedAt: '2026-04-19 11:20',
    },
    {
      service: 'Worker',
      status: 'UP',
      detail: '센서 스트림 처리 중',
      updatedAt: '2026-04-19 11:20',
    },
    {
      service: 'Cloud Ingest',
      status: 'UP',
      detail: 'outbox 수신 정상',
      updatedAt: '2026-04-19 11:20',
    },
    {
      service: 'Display Board',
      status: 'WARN',
      detail: '일부 장치 응답 지연',
      updatedAt: '2026-04-19 11:18',
    },
  ];
}