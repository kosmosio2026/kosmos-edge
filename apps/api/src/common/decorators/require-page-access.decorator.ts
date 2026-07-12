import { SetMetadata } from '@nestjs/common';

export type PageActionType = 'view' | 'create' | 'update' | 'delete' | 'approve' | 'export';

export interface PageAccessRequirement {
  pageCode: string;
  action?: PageActionType;
}

export const PAGE_ACCESS_KEY = 'page_access';
export const RequirePageAccess = (requirement: PageAccessRequirement) =>
  SetMetadata(PAGE_ACCESS_KEY, requirement);
