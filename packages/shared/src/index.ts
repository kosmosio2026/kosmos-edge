export * from './ws-events';
export * from "./validation/auth.validation";
export * from "./validation/security.validation";
export * from "./validation/sync.validation";

export interface PaginatedMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginatedMeta;
}

export interface StandardListResponse<T> {
  items: T[];
  meta: PaginatedMeta;
}

export const WsEvents = {
  SESSION_ENTERED: 'session.entered',
  SESSION_EXITED: 'session.exited',
  SESSION_CLOSED: 'session.closed',

  INVOICE_ISSUED: 'invoice.issued',
  INVOICE_UPDATED: 'invoice.updated',

  PAYMENT_CREATED: 'payment.created',
  PAYMENT_UPDATED: 'payment.updated',
  PAYMENT_FAILED: 'payment.failed',

  SPACE_STATUS_CHANGED: 'space.status.changed',

  VIOLATION_DETECTED: 'violation.detected',
  VIOLATION_RESOLVED: 'violation.resolved',
  DEVICE_OFFLINE: 'device.offline',

  DISPLAY_DATA_UPDATED: 'display.data.updated',
} as const;

export type WsEventName = (typeof WsEvents)[keyof typeof WsEvents];