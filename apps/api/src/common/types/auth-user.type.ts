export type AuthUser = {
  sub: string;
  id: string;
  email: string | null;
  name: string | null;
  roles: string[];
  permissions: string[];
  isApproved: boolean;
  status?: string;
  emailVerifiedAt?: Date | string | null;
  tenantId?: string | null;
  scopes: {
    parkingLotIds: string[];
    parkingSectionIds: string[];
    parkingSpaceIds: string[];
  };
};