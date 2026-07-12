import type { AuthUser, LoginMenuItem, LoginRole } from '@/types/auth';
import { PERMISSIONS } from '@/lib/rbac/permissions';
import { FEATURES } from '@/lib/features';

export type MenuGroup =
  | 'dashboard'
  | 'approvals'
  | 'parking'
  | 'facilities'
  | 'devices'
  | 'fees'
  | 'users'
  | 'billing'
  | 'display'
  | 'settings'
  | 'enforcement'
  | 'operator'
  | 'rbac'
  | 'system';

export type ConsoleMenuEntry = LoginMenuItem & {
  group: MenuGroup;
  order: number;
  description?: string;
};

export type ScopeLevel = 'global' | 'lot' | 'section';

function menu(
  entry: Omit<ConsoleMenuEntry, 'scopeLevel'> & {
    scopeLevel?: ScopeLevel;
  },
): ConsoleMenuEntry {
  return entry;
}

export const consoleMenus: ConsoleMenuEntry[] = [
  menu({
    label: '대시보드',
    href: '/admin/dashboard',
    roles: ['ADMIN'],
    permission: PERMISSIONS.ANALYTICS_READ,
    scopeLevel: 'global',
    order: 11,
    group: 'dashboard',
  }),
  menu({
    label: '제어 패널',
    href: '/admin/control-panel',
    roles: ['ADMIN'],
    permission: PERMISSIONS.CONTROL_PANEL_MANAGE,
    group: 'dashboard',
    order: 12,
    scopeLevel: 'global',
    description: '서비스 및 하드웨어 제어',
  }),
  menu({
    label: '지도',
    href: '/admin/map',
    roles: ['ADMIN'],
    permission: PERMISSIONS.OPERATOR_DASHBOARD_READ,
    group: 'dashboard',
    order: 13,
    scopeLevel: 'global',
    description: '주차장 지도 및 주차면 상태',
  }),
  menu({
    label: '그리드',
    href: '/admin/grid',
    roles: ['ADMIN'],
    permission: PERMISSIONS.OPERATOR_DASHBOARD_READ,
    group: 'dashboard',
    order: 14,
    scopeLevel: 'global',
    description: '주차면 그리드 상태',
  }),

  menu({
    label: '대시보드',
    href: '/manager/dashboard',
    roles: ['MANAGER'],
    permission: PERMISSIONS.ANALYTICS_READ,
    scopeLevel: 'lot',
    order: 11,
    group: 'dashboard',
  }),

  menu({
    label: '제어 패널',
    href: '/manager/control-panel',
    roles: ['MANAGER'],
    permission: PERMISSIONS.CONTROL_PANEL_MANAGE,
    group: 'dashboard',
    order: 12,
    scopeLevel: 'lot',
    description: '권한 서비스 및 하드웨어 제어',
  }),
  menu({
    label: '지도',
    href: '/manager/map',
    roles: ['MANAGER'],
    permission: PERMISSIONS.OPERATOR_DASHBOARD_READ,
    group: 'dashboard',
    order: 13,
    scopeLevel: 'lot',
    description: '권한 주차장 지도 및 주차면 상태',
  }),
  menu({
    label: '그리드',
    href: '/manager/grid',
    roles: ['MANAGER'],
    permission: PERMISSIONS.OPERATOR_DASHBOARD_READ,
    group: 'dashboard',
    order: 14,
    scopeLevel: 'lot',
    description: '권한 주차장의 그리드 상태',
  }),

  menu({
    label: '매니저 승인',
    href: '/admin/approvals/managers',
    roles: ['ADMIN'],
    permission: PERMISSIONS.USER_MANAGE,
    group: 'approvals',
    order: 20,
    scopeLevel: 'global',
    description: '매니저 승인 요청 관리',
  }),
  menu({
    label: '운영자 승인',
    href: '/admin/approvals/operators',
    roles: ['ADMIN'],
    permission: PERMISSIONS.USER_MANAGE,
    group: 'approvals',
    order: 21,
    scopeLevel: 'global',
    description: '운영자 승인 요청 관리',
  }),
  menu({
    label: '매니저 주차장 승인',
    href: '/admin/approvals/manager-lots',
    roles: ['ADMIN'],
    permission: PERMISSIONS.USER_MANAGE,
    group: 'approvals',
    order: 22,
    scopeLevel: 'global',
    description: '매니저 주차장 신청 승인',
  }),
  menu({
    label: '운영자 구역 신청',
    href: '/admin/approvals/operator-sections',
    roles: ['ADMIN'],
    permission: PERMISSIONS.USER_MANAGE,
    group: 'approvals',
    order: 23,
    scopeLevel: 'global',
    description: '운영자 섹션 신청 승인',
  }),
  menu({
    label: 'Watcher 승인',
    href: '/admin/watcher-approvals',
    roles: ['ADMIN'],
    permission: PERMISSIONS.USER_MANAGE,
    group: 'approvals',
    order: 24,
    scopeLevel: 'global',
    description: 'Watcher 주차장 신청 승인',
  }),
  menu({
    label: '직권 등록 이력',
    href: '/admin/authority-registrations',
    roles: ['ADMIN'],
    permission: PERMISSIONS.AUTHORITY_REGISTRATION_REVIEW,
    group: 'enforcement',
    order: 101,
    scopeLevel: 'global',
    description: '직권 등록 검수, 정정, OCR 결과 확인',
  }),

  menu({
    label: '운영자 승인',
    href: '/manager/approvals/operators',
    roles: ['MANAGER'],
    permission: PERMISSIONS.USER_MANAGE,
    group: 'approvals',
    order: 21,
    scopeLevel: 'lot',
    description: '운영자 승인 요청 관리',
  }),
  menu({
    label: '운영자 구역 신청',
    href: '/manager/approvals/operator-sections',
    roles: ['MANAGER'],
    permission: PERMISSIONS.USER_MANAGE,
    group: 'approvals',
    order: 22,
    scopeLevel: 'lot',
    description: '운영자 섹션 신청 승인',
  }),
  menu({
    label: '주차장 신청',
    href: '/manager/requests/parking-lots',
    roles: ['MANAGER'],
    permission: PERMISSIONS.PARKING_LOT_READ,
    group: 'approvals',
    order: 23,
    scopeLevel: 'lot',
    description: '주차장 접근 및 생성 신청',
  }),
  menu({
    label: 'Watcher 승인',
    href: '/manager/watcher-approvals',
    roles: ['MANAGER'],
    permission: PERMISSIONS.USER_MANAGE,
    group: 'approvals',
    order: 24,
    scopeLevel: 'lot',
    description: 'Watcher 주차장 신청 승인',
  }),

  menu({
    label: '직권 등록 이력',
    href: '/manager/authority-registrations',
    roles: ['MANAGER'],
    permission: PERMISSIONS.AUTHORITY_REGISTRATION_REVIEW,
    group: 'enforcement',
    order: 101,
    scopeLevel: 'lot',
    description: '담당 주차장 직권 등록 검수, 정정',
  }),

  menu({
    label: '구역 신청',
    href: '/operator/requests/sections',
    roles: ['OPERATOR'],
    permission: PERMISSIONS.PARKING_SECTION_READ,
    group: 'approvals',
    order: 22,
    scopeLevel: 'section',
    description: '운영 섹션 권한 신청',
  }),

  /**
   * PARKING
   */
  menu({
    label: '주차 현황',
    href: '/admin/parking/sessions',
    roles: ['ADMIN'],
    permission: PERMISSIONS.SESSION_MANAGE,
    order: 29,
    scopeLevel: 'global',
    group: 'parking',
    description: '주차 세션 목록 조회',
  }),
  menu({
    label: '주차 현황',
    href: '/manager/parking/sessions',
    roles: ['MANAGER'],
    permission: PERMISSIONS.SESSION_MANAGE,
    order: 29,
    scopeLevel: 'lot',
    group: 'parking',
    description: '주차 세션 목록 조회',
  }),
  menu({
    label: '주차 현황',
    href: '/operator/parking/sessions',
    roles: ['OPERATOR'],
    permission: PERMISSIONS.SESSION_MANAGE,
    order: 29,
    scopeLevel: 'section',
    group: 'parking',
    description: '주차 세션 목록 조회',
  }),

  menu({
    label: '주차 이력',
    href: '/admin/parking/history',
    roles: ['ADMIN'],
    permission: PERMISSIONS.SESSION_MANAGE,
    order: 30,
    scopeLevel: 'global',
    group: 'parking',
    description: '종료된 주차 세션 이력',
  }),
  menu({
    label: '주차 이력',
    href: '/manager/parking/history',
    roles: ['MANAGER'],
    permission: PERMISSIONS.SESSION_MANAGE,
    order: 30,
    scopeLevel: 'lot',
    group: 'parking',
    description: '권한 주차장 종료 세션 이력',
  }),
  menu({
    label: '주차 이력',
    href: '/operator/parking/history',
    roles: ['OPERATOR'],
    permission: PERMISSIONS.SESSION_MANAGE,
    order: 30,
    scopeLevel: 'section',
    group: 'parking',
    description: '운영 종료 세션 이력',
  }),

  menu({
    label: '주차장',
    href: '/admin/facilities/lots',
    roles: ['ADMIN'],
    permission: PERMISSIONS.PARKING_LOT_READ,
    group: 'facilities',
    order: 30,
    scopeLevel: 'global',
    description: '전체 주차장 관리',
  }),
  menu({
    label: '주차장',
    href: '/manager/facilities/lots',
    roles: ['MANAGER'],
    permission: PERMISSIONS.PARKING_LOT_READ,
    group: 'facilities',
    order: 30,
    scopeLevel: 'lot',
    description: '권한 주차장 관리',
  }),
  menu({
    label: '주차장',
    href: '/operator/facilities/lots',
    roles: ['OPERATOR'],
    permission: PERMISSIONS.PARKING_LOT_READ,
    group: 'facilities',
    order: 30,
    scopeLevel: 'lot',
    description: '권한 주차장 조회',
  }),

  menu({
    label: '주차 구역',
    href: '/admin/facilities/sections',
    roles: ['ADMIN'],
    permission: PERMISSIONS.PARKING_SECTION_READ,
    group: 'facilities',
    order: 31,
    scopeLevel: 'global',
    description: '주차구획 관리',
  }),
  menu({
    label: '주차 구역',
    href: '/manager/facilities/sections',
    roles: ['MANAGER'],
    permission: PERMISSIONS.PARKING_SECTION_READ,
    group: 'facilities',
    order: 31,
    scopeLevel: 'lot',
    description: '권한 주차구획 관리',
  }),
  menu({
    label: '주차 구역',
    href: '/operator/facilities/sections',
    roles: ['OPERATOR'],
    permission: PERMISSIONS.PARKING_SECTION_READ,
    group: 'facilities',
    order: 31,
    scopeLevel: 'section',
    description: '주차구획 조회',
  }),

  menu({
    label: '주차면',
    href: '/admin/facilities/spaces',
    roles: ['ADMIN'],
    permission: PERMISSIONS.PARKING_SPACE_READ,
    group: 'facilities',
    order: 32,
    scopeLevel: 'global',
    description: '주차면 및 센서 매핑 관리',
  }),
  menu({
    label: '주차면',
    href: '/manager/facilities/spaces',
    roles: ['MANAGER'],
    permission: PERMISSIONS.PARKING_SPACE_READ,
    group: 'facilities',
    order: 32,
    scopeLevel: 'lot',
    description: '권한 주차면 관리',
  }),
  menu({
    label: '주차면',
    href: '/operator/facilities/spaces',
    roles: ['OPERATOR'],
    permission: PERMISSIONS.PARKING_SPACE_READ,
    group: 'facilities',
    order: 32,
    scopeLevel: 'section',
    description: '주차면 조회',
  }),

  menu({
    label: '레이아웃 편집기',
    href: '/admin/facilities/map-editor',
    roles: ['ADMIN'],
    permission: PERMISSIONS.PARKING_SPACE_WRITE,
    group: 'facilities',
    order: 33,
    scopeLevel: 'global',
    description: '지도 기반 주차면 배치 설계',
  }),
  menu({
    label: '레이아웃 편집기',
    href: '/manager/facilities/map-editor',
    roles: ['MANAGER'],
    permission: PERMISSIONS.PARKING_SPACE_WRITE,
    group: 'facilities',
    order: 33,
    scopeLevel: 'lot',
    description: '권한 주차장 배치 설계',
  }),

  menu({
    label: '장치',
    href: '/admin/devices/list',
    roles: ['ADMIN'],
    permission: PERMISSIONS.DEVICE_MANAGE,
    group: 'devices',
    order: 40,
    scopeLevel: 'global',
    description: '장치 목록 관리',
  }),
  menu({
    label: '장치',
    href: '/manager/devices/list',
    roles: ['MANAGER'],
    permission: PERMISSIONS.DEVICE_MANAGE,
    group: 'devices',
    order: 40,
    scopeLevel: 'lot',
    description: '권한 장치 목록 관리',
  }),
  menu({
    label: '장치',
    href: '/operator/devices/list',
    roles: ['OPERATOR'],
    permission: PERMISSIONS.DEVICE_MANAGE,
    group: 'devices',
    order: 40,
    scopeLevel: 'section',
    description: '장치 목록 조회',
  }),

  menu({
    label: '장애 관리',
    href: '/admin/devices/faults',
    roles: ['ADMIN'],
    permission: PERMISSIONS.DEVICE_MANAGE,
    group: 'devices',
    order: 41,
    scopeLevel: 'global',
    description: '장애 및 유지보수 관리',
  }),
  menu({
    label: '장애 관리',
    href: '/manager/devices/faults',
    roles: ['MANAGER'],
    permission: PERMISSIONS.DEVICE_MANAGE,
    group: 'devices',
    order: 41,
    scopeLevel: 'lot',
    description: '권한 장치 장애 관리',
  }),
  menu({
    label: '장애 관리',
    href: '/operator/devices/faults',
    roles: ['OPERATOR'],
    permission: PERMISSIONS.DEVICE_MANAGE,
    group: 'devices',
    order: 41,
    scopeLevel: 'section',
    description: '장치 장애 확인',
  }),

  menu({
    label: '센서 스트림',
    href: '/admin/devices/sensor-stream',
    roles: ['ADMIN'],
    permission: PERMISSIONS.DEVICE_READ,
    group: 'devices',
    order: 42,
    scopeLevel: 'global',
    description: '실시간 센서 데이터 스트림 모니터링',
  }),

  menu({
    label: '센서',
    href: '/admin/devices/sensors',
    roles: ['ADMIN'],
    permission: PERMISSIONS.DEVICE_MANAGE,
    group: 'devices',
    order: 43,
    scopeLevel: 'global',
    description: '센서 실시간 상태',
  }),
  menu({
    label: '센서',
    href: '/manager/devices/sensors',
    roles: ['MANAGER'],
    permission: PERMISSIONS.DEVICE_MANAGE,
    group: 'devices',
    order: 43,
    scopeLevel: 'lot',
    description: '권한 센서 실시간 상태',
  }),
  menu({
    label: '센서',
    href: '/operator/devices/sensors',
    roles: ['OPERATOR'],
    permission: PERMISSIONS.DEVICE_MANAGE,
    group: 'devices',
    order: 43,
    scopeLevel: 'section',
    description: '센서 실시간 상태',
  }),

  menu({
    label: '요금 정책',
    href: '/admin/fees/policies',
    roles: ['ADMIN'],
    permission: PERMISSIONS.BILLING_FEE_POLICY_MANAGE,
    group: 'fees',
    order: 50,
    scopeLevel: 'global',
    description: '요금 정책 설정',
  }),
  menu({
    label: '요금 정책',
    href: '/manager/fees/policies',
    roles: ['MANAGER'],
    permission: PERMISSIONS.BILLING_FEE_POLICY_MANAGE,
    group: 'fees',
    order: 50,
    scopeLevel: 'lot',
    description: '권한 주차장 요금 정책',
  }),
  menu({
    label: '요금 정책',
    href: '/operator/fees/policies',
    roles: ['OPERATOR'],
    permission: PERMISSIONS.BILLING_FEE_POLICY_READ,
    group: 'fees',
    order: 50,
    scopeLevel: 'lot',
    description: '요금 정책 조회',
  }),

  menu({
    label: '할인 프로그램',
    href: '/admin/fees/discounts',
    roles: ['ADMIN'],
    permission: PERMISSIONS.BILLING_DISCOUNT_MANAGE,
    group: 'fees',
    order: 51,
    scopeLevel: 'global',
    description: '할인 정책 관리',
  }),
  menu({
    label: '할인 프로그램',
    href: '/manager/fees/discounts',
    roles: ['MANAGER'],
    permission: PERMISSIONS.BILLING_DISCOUNT_MANAGE,
    group: 'fees',
    order: 51,
    scopeLevel: 'lot',
    description: '권한 할인 정책 관리',
  }),
  menu({
    label: '할인 프로그램',
    href: '/operator/fees/discounts',
    roles: ['OPERATOR'],
    permission: PERMISSIONS.BILLING_DISCOUNT_READ,
    group: 'fees',
    order: 51,
    scopeLevel: 'lot',
    description: '할인 정책 조회',
  }),

    /**
   * USERS
   */
    /**
  menu({
    label: '사용자 승인',
    href: '/admin/users',
    roles: ['ADMIN'],
    permission: PERMISSIONS.USER_MANAGE,
    group: 'users',
    order: 57,
    scopeLevel: 'global',
    description: '사용자 승인 및 주차장 권한 부여',
  }),
  */
  menu({
    label: 'Tenant 관리',
    href: '/admin/tenants',
    roles: ['ADMIN'],
    permission: PERMISSIONS.USER_MANAGE,
    group: 'users',
    order: 57,
    scopeLevel: 'global',
    description: '회사/조직 Tenant 관리',
  }),
  menu({
    label: '관리자',
    href: '/admin/users/managers',
    roles: ['ADMIN'],
    permission: PERMISSIONS.USER_MANAGE,
    group: 'users',
    order: 58,
    scopeLevel: 'global',
    description: '관리자 계정 관리',
  }),
  menu({
    label: '운영자',
    href: '/admin/users/operators',
    roles: ['ADMIN'],
    permission: PERMISSIONS.USER_MANAGE,
    group: 'users',
    order: 59,
    scopeLevel: 'global',
    description: '운영자 계정 관리',
  }),
    /**
  
  menu({
    label: '사용자 승인',
    href: '/manager/users',
    roles: ['MANAGER'],
    permission: PERMISSIONS.USER_MANAGE,
    group: 'users',
    order: 57,
    scopeLevel: 'lot',
    description: '권한 사용자 승인 및 주차장 권한 부여',
  }),
  */
  menu({
    label: '운영자',
    href: '/manager/users/operators',
    roles: ['MANAGER'],
    permission: PERMISSIONS.USER_MANAGE,
    group: 'users',
    order: 59,
    scopeLevel: 'lot',
    description: '권한 주차장 운영자 관리',
  }),
  menu({
    label: '회원',
    href: '/admin/users/members',
    roles: ['ADMIN'],
    permission: PERMISSIONS.USER_MANAGE,
    group: 'users',
    order: 60,
    scopeLevel: 'global',
    description: '회원 관리',
  }),
  menu({
    label: '회원',
    href: '/manager/users/members',
    roles: ['MANAGER'],
    permission: PERMISSIONS.USER_MANAGE,
    group: 'users',
    order: 60,
    scopeLevel: 'lot',
    description: '권한 회원 관리',
  }),
/**
  menu({
    label: '회원',
    href: '/operator/users/members',
    roles: ['OPERATOR'],
    permission: PERMISSIONS.USER_READ,
    group: 'users',
    order: 60,
    scopeLevel: 'lot',
    description: '회원 조회',
  }),
*/
  menu({
    label: '방문객',
    href: '/admin/users/visitors',
    roles: ['ADMIN'],
    permission: PERMISSIONS.USER_MANAGE,
    group: 'users',
    order: 61,
    scopeLevel: 'global',
    description: '방문자 관리',
  }),
  menu({
    label: '방문객',
    href: '/manager/users/visitors',
    roles: ['MANAGER'],
    permission: PERMISSIONS.USER_MANAGE,
    group: 'users',
    order: 61,
    scopeLevel: 'lot',
    description: '권한 방문자 관리',
  }),
  /**
  menu({
    label: '방문객',
    href: '/operator/users/visitors',
    roles: ['OPERATOR'],
    permission: PERMISSIONS.USER_READ,
    group: 'users',
    order: 61,
    scopeLevel: 'lot',
    description: '방문자 조회',
  }),
  */

  /**
   * OPERATOR ONLY
   */
{
  label: '대시보드',
  description: '실시간 운영 현황',
  href: '/operator/dashboard',
  roles: ['OPERATOR'],
  permission: PERMISSIONS.OPERATOR_DASHBOARD_READ,
  group: 'dashboard',
  order: 10,
  scopeLevel: 'global',
},
{
  label: '지도',
  description: '주차장 지도 및 주차면 상태',
  href: '/operator/map',
  roles: ['OPERATOR'],
  permission: PERMISSIONS.OPERATOR_DASHBOARD_READ,
  group: 'dashboard',
  order: 20,
  scopeLevel: 'global',
},



  menu({
    label: '정산 요약',
    href: '/admin/billing/summary',
    roles: ['ADMIN'],
    permission: PERMISSIONS.BILLING_SUMMARY_READ,
    group: 'billing',
    order: 79,
    scopeLevel: 'global',
    description: '매출 및 미수금 요약',
  }),
  menu({
    label: '그리드',
    href: '/operator/grid',
    roles: ['OPERATOR'],
    permission: PERMISSIONS.OPERATOR_DASHBOARD_READ,
    group: 'dashboard',
    order: 14,
    scopeLevel: 'section',
    description: '주차면 그리드 상태',
  }),

  menu({
    label: '정산 요약',
    href: '/manager/billing/summary',
    roles: ['MANAGER'],
    permission: PERMISSIONS.BILLING_SUMMARY_READ,
    group: 'billing',
    order: 79,
    scopeLevel: 'lot',
    description: '권한 매출 요약',
  }),
  menu({
    label: '정산 요약',
    href: '/operator/billing/summary',
    roles: ['OPERATOR'],
    permission: PERMISSIONS.BILLING_SUMMARY_READ,
    group: 'billing',
    order: 79,
    scopeLevel: 'lot',
    description: '운영 정산 요약',
  }),

  menu({
    label: '정산/결제',
    href: '/admin/billing',
    roles: ['ADMIN'],
    permission: PERMISSIONS.PAYMENT_MANAGE,
    group: 'billing',
    order: 80,
    scopeLevel: 'global',
    description: '정산 및 요금 처리',
  }),
  menu({
    label: '정산/결제',
    href: '/manager/billing',
    roles: ['MANAGER'],
    permission: PERMISSIONS.PAYMENT_MANAGE,
    group: 'billing',
    order: 80,
    scopeLevel: 'lot',
    description: '권한 정산 및 요금 처리',
  }),
  menu({
    label: '정산/결제',
    href: '/operator/billing',
    roles: ['OPERATOR'],
    permission: PERMISSIONS.PAYMENT_READ,
    group: 'billing',
    order: 80,
    scopeLevel: 'lot',
    description: '운영 정산 처리',
  }),

  menu({
    label: '미납 현황',
    href: '/admin/billing/outstanding',
    roles: ['ADMIN'],
    permission: PERMISSIONS.OUTSTANDING_MANAGE,
    group: 'billing',
    order: 81,
    scopeLevel: 'global',
    description: '미수금 및 체납 관리',
  }),
  menu({
    label: '미납 현황',
    href: '/manager/billing/outstanding',
    roles: ['MANAGER'],
    permission: PERMISSIONS.OUTSTANDING_MANAGE,
    group: 'billing',
    order: 81,
    scopeLevel: 'lot',
    description: '권한 미수금 관리',
  }),
  menu({
    label: '미납 현황',
    href: '/operator/billing/outstanding',
    roles: ['OPERATOR'],
    permission: PERMISSIONS.PAYMENT_READ,
    group: 'billing',
    order: 81,
    scopeLevel: 'lot',
    description: '미수금 확인',
  }),

  menu({
    label: '정산 마감',
    href: '/admin/billing/settlement',
    roles: ['ADMIN'],
    permission: PERMISSIONS.SETTLEMENT_MANAGE,
    group: 'billing',
    order: 82,
    scopeLevel: 'global',
    description: '일별 정산 마감',
  }),
  menu({
    label: '정산 마감',
    href: '/manager/billing/settlement',
    roles: ['MANAGER'],
    permission: PERMISSIONS.SETTLEMENT_MANAGE,
    group: 'billing',
    order: 82,
    scopeLevel: 'lot',
    description: '권한 정산 마감',
  }),
  menu({
    label: '정산 마감',
    href: '/operator/billing/settlement',
    roles: ['OPERATOR'],
    permission: PERMISSIONS.SETTLEMENT_READ,
    group: 'billing',
    order: 82,
    scopeLevel: 'lot',
    description: '정산 조회',
  }),


  menu({
    label: '전광판 운영',
    href: '/manager/display',
    roles: ['MANAGER'],
    permission: PERMISSIONS.DISPLAY_READ,
    group: 'display',
    order: 85,
    scopeLevel: 'lot',
    description: '권한 전광판 표시 현황',
  }),
  menu({
    label: '전광판 설정',
    href: '/manager/display/settings',
    roles: ['MANAGER'],
    permission: PERMISSIONS.DISPLAY_READ,
    group: 'display',
    order: 86,
    scopeLevel: 'lot',
    description: '권한 주차장 전광판 통신 및 모듈 설정',
  }),

  menu({
    label: '전광판 운영',
    href: '/operator/display',
    roles: ['OPERATOR'],
    permission: PERMISSIONS.DISPLAY_READ,
    group: 'display',
    order: 85,
    scopeLevel: 'lot',
    description: '전광판 표시 현황',
  }),
  menu({
    label: '전광판 키오스크',
    href: '/operator/display/kiosk',
    roles: ['OPERATOR'],
    permission: PERMISSIONS.DISPLAY_READ,
    group: 'display',
    order: 87,
    scopeLevel: 'lot',
    description: '전광판 전체 화면 미리보기',
  }),

  menu({
    label: '주차 단속',
    href: '/admin/enforcement',
    roles: ['ADMIN'],
    permission: PERMISSIONS.ENFORCEMENT_MANAGE,
    group: 'enforcement',
    order: 87,
    scopeLevel: 'global',
    description: '전체 위반 세션 및 단속 관리',
  }),
  menu({
    label: '주차 단속',
    href: '/manager/enforcement',
    roles: ['MANAGER'],
    permission: PERMISSIONS.ENFORCEMENT_MANAGE,
    group: 'enforcement',
    order: 87,
    scopeLevel: 'lot',
    description: '권한 위반 세션 및 단속 관리',
  }),
  menu({
    label: '주차 단속',
    href: '/operator/enforcement',
    roles: ['OPERATOR'],
    permission: PERMISSIONS.ENFORCEMENT_MANAGE,
    group: 'enforcement',
    order: 87,
    scopeLevel: 'section',
    description: '운영 단속 대상 확인',
  }),
/*
  menu({
    label: '역할',
    href: '/admin/rbac/roles',
    roles: ['ADMIN'],
    permission: PERMISSIONS.RBAC_MANAGE,
    group: 'rbac',
    order: 88,
    scopeLevel: 'global',
    description: '역할 관리',
  }),
  menu({
    label: '메뉴 권한',
    href: '/admin/rbac/menu-access',
    roles: ['ADMIN'],
    permission: PERMISSIONS.RBAC_MANAGE,
    group: 'rbac',
    order: 89,
    scopeLevel: 'global',
    description: '메뉴 접근 권한',
  }),
  menu({
    label: '리소스 권한',
    href: '/admin/rbac/resource-access',
    roles: ['ADMIN'],
    permission: PERMISSIONS.RBAC_MANAGE,
    group: 'rbac',
    order: 90,
    scopeLevel: 'global',
    description: '리소스 접근 권한',
  }),
*/

  menu({
    label: '설정',
    href: '/admin/settings',
    roles: ['ADMIN'],
    group: 'settings',
    order: 101,
    scopeLevel: 'global',
    description: '관리자 설정',
  }),
  menu({
    label: '설정',
    href: '/manager/settings',
    roles: ['MANAGER'],
    group: 'settings',
    order: 101,
    scopeLevel: 'global',
    description: '매니저 설정',
  }),
  menu({
    label: '설정',
    href: '/operator/settings',
    roles: ['OPERATOR'],
    group: 'settings',
    order: 101,
    scopeLevel: 'global',
    description: '운영자 설정',
  }),
];

function isVisibleByFeature(item: ConsoleMenuEntry) {
  if (!FEATURES.kakaoMap && item.href.endsWith('/map')) {
    return false;
  }

  return true;
}

export const visibleConsoleMenus = consoleMenus.filter(isVisibleByFeature);


function hasPermission(user: AuthUser, permission?: string) {
  if (!permission) return true;
  if (user.roles.includes('ADMIN')) return true;
  return Array.isArray(user.permissions) && user.permissions.includes(permission);
}

function hasRole(user: AuthUser, roles: LoginRole[]) {
  return roles.some((role) => user.roles.includes(role));
}

function scopeCount(
  user: AuthUser,
  key: 'parkingLotIds' | 'parkingSectionIds',
) {
  const scopes = user.scopes ?? {};
  const values = scopes[key];
  return Array.isArray(values) ? values.length : 0;
}

function hasScopeForLevel(
  user: AuthUser,
  scopeLevel?: 'lot' | 'section' | 'global',
) {
  if (!scopeLevel || scopeLevel === 'global') return true;
  if (user.roles.includes('ADMIN')) return true;

  const lotScopeCount = scopeCount(user, 'parkingLotIds');
  const sectionScopeCount = scopeCount(user, 'parkingSectionIds');

  /*
   Dev/test behavior:
   Newly seeded manager/operator accounts may not have scope bindings yet.
   We still show the role menu so the UI can be tested.
   Backend APIs should continue enforcing real scope access.
  */
  const hasNoAssignedScopes =
    lotScopeCount === 0 &&
    sectionScopeCount === 0;

  if (hasNoAssignedScopes) return true;

  if (scopeLevel === 'lot') {
    return lotScopeCount > 0;
  }

  if (scopeLevel === 'section') {
    return sectionScopeCount > 0 || lotScopeCount > 0;
  }

  return true;
}

export function getVisibleConsoleMenus(user: AuthUser | null | undefined) {
  if (!user) return [];

  return visibleConsoleMenus
    .filter(
      (entry) =>
        hasRole(user, entry.roles) &&
        hasPermission(user, entry.permission) &&
        hasScopeForLevel(user, entry.scopeLevel),
    )
    .sort((a, b) => a.order - b.order);
}

export function getVisibleConsoleMenuGroups(user: AuthUser | null | undefined) {
  const visible = getVisibleConsoleMenus(user);

  return visible.reduce(
    (acc, entry) => {
      if (!acc[entry.group]) {
        acc[entry.group] = [];
      }

      acc[entry.group]!.push(entry);
      return acc;
    },
    {} as Partial<Record<MenuGroup, ConsoleMenuEntry[]>>,
  );
}

export function getDefaultConsoleHome(user: AuthUser | null | undefined) {
  if (!user) return '/login';
  if (user.roles.includes('ADMIN')) return '/admin/dashboard';
  if (user.roles.includes('MANAGER')) return '/manager/dashboard';
  if (user.roles.includes('OPERATOR')) return '/operator/dashboard';
  if (user.roles.includes('MEMBER')) return '/member';
  if (user.roles.includes('VISITOR')) return '/visitor';

  return '/';
}

