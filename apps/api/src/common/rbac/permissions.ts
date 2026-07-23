export const PERMISSIONS = {
  ANALYTICS_READ: 'analytics.read',

  USER_READ: 'user.read',
  USER_MANAGE: 'user.manage',
  AUTHORITY_REGISTRATION_REVIEW: 'authority-registration.review',

  SESSION_MANAGE: 'session.manage',
  DEVICE_READ: 'device.read',
  DEVICE_MANAGE: 'device.manage',
  DEVICE_FAULT_READ: 'device.fault.read',
  DEVICE_FAULT_ACKNOWLEDGE: 'device.fault.acknowledge',
  DEVICE_FAULT_RESOLVE: 'device.fault.resolve',

  BILLING_READ: 'billing.read',
  BILLING_MANAGE: 'billing.manage',
  BILLING_SUMMARY_READ: 'billing.summary.read',
  
  BILLING_FEE_POLICY_READ: 'billing.fee-policy.read',
  BILLING_FEE_POLICY_MANAGE: 'billing.fee-policy.manage',
  
  BILLING_DISCOUNT_READ: 'billing.discount.read',
  BILLING_DISCOUNT_MANAGE: 'billing.discount.manage',

  TENANT_COUPON_READ: 'tenant.coupon.read',
  TENANT_COUPON_MANAGE: 'tenant.coupon.manage',
  TENANT_COUPON_ASSIGN: 'tenant.coupon.assign',

  PAYMENT_READ: 'payment.read',
  PAYMENT_MANAGE: 'payment.manage',
  RECEIPT_ISSUE: 'receipt.issue',

  OUTSTANDING_READ: 'outstanding.read',
  OUTSTANDING_MANAGE: 'outstanding.manage',

  SETTLEMENT_READ: 'settlement.read',
  SETTLEMENT_MANAGE: 'settlement.manage',

  ENFORCEMENT_MANAGE: 'enforcement.manage',

  CONTROL_PANEL_READ: 'control-panel.read',
  CONTROL_PANEL_MANAGE: 'control-panel.manage',
  OPERATOR_DASHBOARD_READ: 'operator.dashboard.read',

  PARKING_LOT_READ: 'parking.lot.read',
  PARKING_SECTION_READ: 'parking.section.read',
  PARKING_SECTION_WRITE: 'parking.section.write',
  PARKING_SPACE_READ: 'parking.space.read',
  PARKING_SPACE_WRITE: 'parking.space.write',

  DISPLAY_READ: 'display.read',
  DISPLAY_MANAGE: 'display.manage',
  DISPLAY_COMMAND: 'display.command',

  RBAC_MANAGE: 'rbac.manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];