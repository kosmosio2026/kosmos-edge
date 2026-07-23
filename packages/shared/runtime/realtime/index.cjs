const WsEvents = {
  PARKING_SESSION_CREATED: "parking.session.created",
  PARKING_SESSION_UPDATED: "parking.session.updated",
  PARKING_SESSION_ENDED: "parking.session.ended",
  PARKING_SPACE_UPDATED: "parking.space.updated",
  SENSOR_EVENT_RECEIVED: "sensor.event.received",

  PAYMENT_CREATED: "payment.created",
  PAYMENT_UPDATED: "payment.updated",
  PAYMENT_COMPLETED: "payment.completed",
  PAYMENT_FAILED: "payment.failed",

  SESSION_CLOSED: "session.closed",

  INVOICE_CREATED: "invoice.created",
  INVOICE_UPDATED: "invoice.updated",

  VIOLATION_CREATED: "violation.created",
  VIOLATION_UPDATED: "violation.updated",
  VIOLATION_RESOLVED: "violation.resolved",

  ENFORCEMENT_CREATED: "enforcement.created",
  ENFORCEMENT_UPDATED: "enforcement.updated",

  DEVICE_STATUS_UPDATED: "device.status.updated",
  DISPLAY_UPDATED: "display.updated",
  NOTICE_CREATED: "notice.created",

  parkingSessionCreated: "parking.session.created",
  parkingSessionUpdated: "parking.session.updated",
  parkingSessionEnded: "parking.session.ended",
  parkingSpaceUpdated: "parking.space.updated",
  sensorEventReceived: "sensor.event.received",

  paymentCreated: "payment.created",
  paymentUpdated: "payment.updated",
  paymentCompleted: "payment.completed",
  paymentFailed: "payment.failed",

  sessionClosed: "session.closed",

  invoiceCreated: "invoice.created",
  invoiceUpdated: "invoice.updated",

  violationCreated: "violation.created",
  violationUpdated: "violation.updated",
  violationResolved: "violation.resolved",

  enforcementCreated: "enforcement.created",
  enforcementUpdated: "enforcement.updated",

  deviceStatusUpdated: "device.status.updated",
  displayUpdated: "display.updated",
  noticeCreated: "notice.created"
};

module.exports = { WsEvents };
