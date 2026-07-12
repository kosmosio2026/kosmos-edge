// 🔥 역할 정의
export type LoginRole =
  | 'ADMIN'
  | 'MANAGER'
  | 'OPERATOR'
  | 'MEMBER'
  | 'VISITOR';

// 🔥 Scope 구조 (백엔드와 완전히 일치)
export type UserScopes = {
  parkingLotIds: string[];
  parkingSectionIds: string[];
  parkingSpaceIds?: string[];
};

// 🔥 사용자 타입 (최종)
export type AuthUser = {
  id: string;
  email?: string | null;
  name: string;

  // 🔥 RBAC
  roles: LoginRole[];
  permissions: string[];

  // 🔥 Scope 기반 제어
  scopes: UserScopes;

  // 🔥 상태 플래그 (향후 사용)
  isApproved?: boolean;
};

// 🔥 세션
export type AuthSession = {
  accessToken: string;
  user: AuthUser;
};

// 🔥 메뉴 타입
export type LoginMenuItem = {
  label: string;
  href: string;

  roles: LoginRole[];

  // RBAC permission
  permission?: string;

  // scope 제한
  scopeLevel?: 'global' | 'lot' | 'section';

  // UI 확장용
  icon?: string;
  description?: string;
};