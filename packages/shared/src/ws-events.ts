export const WsEvents = {
  PAYMENT_CREATED: 'payment.created',
  PAYMENT_UPDATED: 'payment.updated',
  PAYMENT_FAILED: 'payment.failed',
  INVOICE_UPDATED: 'invoice.updated',
  SESSION_CLOSED: 'session.closed',

  PARKING_ENTRY: 'parking.entry',
  PARKING_EXIT: 'parking.exit',
  PARKING_STATUS_UPDATE: 'parking_status_update',
  PAYMENT_STATUS_UPDATE: 'payment_status_update',

  DEVICE_FAULT: 'device.fault',
  DEVICE_FAULT_UPDATED: 'device.fault.updated',

  DISPLAY_UPDATED: 'display.updated',
  DISPLAY_HEARTBEAT: 'display.heartbeat',
} as const;

export type WsEventName = (typeof WsEvents)[keyof typeof WsEvents];