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
} as const;

export type WsEventName = (typeof WsEvents)[keyof typeof WsEvents];