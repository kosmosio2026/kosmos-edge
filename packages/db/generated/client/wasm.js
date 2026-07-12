
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  passwordHash: 'passwordHash',
  name: 'name',
  phone: 'phone',
  birthDate: 'birthDate',
  provider: 'provider',
  providerId: 'providerId',
  refreshToken: 'refreshToken',
  emailVerifiedAt: 'emailVerifiedAt',
  lastLoginAt: 'lastLoginAt',
  lockedUntil: 'lockedUntil',
  failedLoginCount: 'failedLoginCount',
  isApproved: 'isApproved',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  tenantId: 'tenantId'
};

exports.Prisma.RoleScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  description: 'description',
  isSystem: 'isSystem',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UserRoleScalarFieldEnum = {
  userId: 'userId',
  roleId: 'roleId',
  assignedAt: 'assignedAt'
};

exports.Prisma.PermissionScalarFieldEnum = {
  id: 'id',
  key: 'key',
  name: 'name',
  module: 'module',
  action: 'action',
  description: 'description',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RolePermissionScalarFieldEnum = {
  roleId: 'roleId',
  permissionId: 'permissionId'
};

exports.Prisma.AppMenuScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  path: 'path',
  icon: 'icon',
  parentId: 'parentId',
  sortOrder: 'sortOrder',
  isVisible: 'isVisible',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AppPageScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  route: 'route',
  module: 'module',
  description: 'description',
  menuId: 'menuId',
  sortOrder: 'sortOrder',
  isVisible: 'isVisible',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PageActionScalarFieldEnum = {
  id: 'id',
  pageId: 'pageId',
  code: 'code',
  name: 'name',
  permissionKey: 'permissionKey',
  createdAt: 'createdAt'
};

exports.Prisma.MenuPolicyScalarFieldEnum = {
  id: 'id',
  key: 'key',
  label: 'label',
  href: 'href',
  group: 'group',
  order: 'order',
  scopeLevel: 'scopeLevel',
  description: 'description',
  isEnabled: 'isEnabled',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RoleMenuPolicyScalarFieldEnum = {
  id: 'id',
  roleId: 'roleId',
  menuId: 'menuId',
  menuPolicyId: 'menuPolicyId',
  canView: 'canView',
  scopeType: 'scopeType',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RolePagePolicyScalarFieldEnum = {
  id: 'id',
  roleId: 'roleId',
  pageId: 'pageId',
  canView: 'canView',
  canCreate: 'canCreate',
  canUpdate: 'canUpdate',
  canDelete: 'canDelete',
  canApprove: 'canApprove',
  canExport: 'canExport',
  scopeType: 'scopeType',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UserScopeBindingScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  scopeType: 'scopeType',
  parkingLotId: 'parkingLotId',
  parkingSectionId: 'parkingSectionId',
  parkingSpaceId: 'parkingSpaceId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.VehicleScalarFieldEnum = {
  id: 'id',
  plateNumber: 'plateNumber',
  vehicleType: 'vehicleType',
  ownerName: 'ownerName',
  memberProfileId: 'memberProfileId',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MemberProfileScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  phone: 'phone',
  vehicleNo: 'vehicleNo',
  membershipNo: 'membershipNo',
  emergencyContact: 'emergencyContact',
  billingAutoPay: 'billingAutoPay',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.VisitorProfileScalarFieldEnum = {
  userId: 'userId',
  phone: 'phone',
  vehicleNo: 'vehicleNo',
  pinCodeHash: 'pinCodeHash',
  note: 'note',
  phoneVerified: 'phoneVerified',
  agreedAt: 'agreedAt',
  lastAuthenticatedAt: 'lastAuthenticatedAt',
  expiresAt: 'expiresAt',
  visitPurpose: 'visitPurpose',
  hostName: 'hostName',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ManagerProfileScalarFieldEnum = {
  userId: 'userId',
  companyName: 'companyName',
  department: 'department',
  isApproved: 'isApproved',
  approvedAt: 'approvedAt',
  approvedById: 'approvedById',
  createdAt: 'createdAt'
};

exports.Prisma.OperatorProfileScalarFieldEnum = {
  userId: 'userId',
  employeeNo: 'employeeNo',
  companyName: 'companyName',
  shiftType: 'shiftType',
  emergencyContact: 'emergencyContact',
  isApproved: 'isApproved',
  approvedAt: 'approvedAt',
  approvedById: 'approvedById',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ParkingLotScalarFieldEnum = {
  id: 'id',
  name: 'name',
  code: 'code',
  region: 'region',
  address: 'address',
  district: 'district',
  timezone: 'timezone',
  lat: 'lat',
  lng: 'lng',
  centerLat: 'centerLat',
  centerLng: 'centerLng',
  representative: 'representative',
  contact: 'contact',
  tenantId: 'tenantId',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  sido: 'sido',
  sigungu: 'sigungu',
  description: 'description',
  operationHours: 'operationHours',
  graceMinutes: 'graceMinutes'
};

exports.Prisma.ParkingSectionScalarFieldEnum = {
  id: 'id',
  name: 'name',
  code: 'code',
  parkingLotId: 'parkingLotId',
  centerLat: 'centerLat',
  centerLng: 'centerLng',
  polygonJson: 'polygonJson',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ParkingSpaceTypeStyleScalarFieldEnum = {
  id: 'id',
  type: 'type',
  label: 'label',
  description: 'description',
  strokeColor: 'strokeColor',
  fillColor: 'fillColor',
  textColor: 'textColor',
  iconKey: 'iconKey',
  iconUrl: 'iconUrl',
  displayOrder: 'displayOrder',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ParkingSpaceScalarFieldEnum = {
  id: 'id',
  code: 'code',
  number: 'number',
  sectionId: 'sectionId',
  type: 'type',
  status: 'status',
  lat: 'lat',
  lng: 'lng',
  widthMeter: 'widthMeter',
  heightMeter: 'heightMeter',
  rotationDeg: 'rotationDeg',
  posX: 'posX',
  posY: 'posY',
  polygonJson: 'polygonJson',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ManagerParkingLotScalarFieldEnum = {
  id: 'id',
  managerProfileUserId: 'managerProfileUserId',
  parkingLotId: 'parkingLotId',
  createdAt: 'createdAt'
};

exports.Prisma.OperatorParkingSectionScalarFieldEnum = {
  id: 'id',
  operatorProfileUserId: 'operatorProfileUserId',
  parkingLotId: 'parkingLotId',
  sectionId: 'sectionId',
  createdAt: 'createdAt'
};

exports.Prisma.ParkingSessionScalarFieldEnum = {
  id: 'id',
  sessionNo: 'sessionNo',
  userId: 'userId',
  vehicleId: 'vehicleId',
  parkingSpaceId: 'parkingSpaceId',
  plateNumber: 'plateNumber',
  sessionType: 'sessionType',
  status: 'status',
  entryGate: 'entryGate',
  exitGate: 'exitGate',
  entryTime: 'entryTime',
  exitTime: 'exitTime',
  graceStartedAt: 'graceStartedAt',
  billingClosedAt: 'billingClosedAt',
  totalMinutes: 'totalMinutes',
  amount: 'amount',
  paidAmount: 'paidAmount',
  unpaidAmount: 'unpaidAmount',
  feePolicyId: 'feePolicyId',
  isRegistered: 'isRegistered',
  registeredAt: 'registeredAt',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  registrationStatus: 'registrationStatus',
  registrationMethod: 'registrationMethod',
  registeredByUserId: 'registeredByUserId',
  contactPhone: 'contactPhone',
  visitorProfileUserId: 'visitorProfileUserId'
};

exports.Prisma.ParkingSessionEventScalarFieldEnum = {
  id: 'id',
  sessionId: 'sessionId',
  type: 'type',
  source: 'source',
  payload: 'payload',
  createdAt: 'createdAt'
};

exports.Prisma.InvoiceScalarFieldEnum = {
  id: 'id',
  invoiceNo: 'invoiceNo',
  sessionId: 'sessionId',
  status: 'status',
  amount: 'amount',
  discountAmount: 'discountAmount',
  paidAmount: 'paidAmount',
  unpaidAmount: 'unpaidAmount',
  baseParkingAmount: 'baseParkingAmount',
  registrationGraceDiscountAmount: 'registrationGraceDiscountAmount',
  authorityRegistrationSurchargeAmount: 'authorityRegistrationSurchargeAmount',
  watcherRewardBasisAmount: 'watcherRewardBasisAmount',
  finalAmount: 'finalAmount',
  issuedAt: 'issuedAt',
  dueAt: 'dueAt',
  paidAt: 'paidAt',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PaymentScalarFieldEnum = {
  id: 'id',
  orderId: 'orderId',
  invoiceId: 'invoiceId',
  amount: 'amount',
  method: 'method',
  status: 'status',
  tossPaymentKey: 'tossPaymentKey',
  tossOrderId: 'tossOrderId',
  tossTransactionKey: 'tossTransactionKey',
  approvedAt: 'approvedAt',
  failedAt: 'failedAt',
  cancelledAt: 'cancelledAt',
  failureCode: 'failureCode',
  failureMessage: 'failureMessage',
  rawResponse: 'rawResponse',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PaymentTransactionScalarFieldEnum = {
  id: 'id',
  transactionNo: 'transactionNo',
  invoiceId: 'invoiceId',
  parkingSessionId: 'parkingSessionId',
  provider: 'provider',
  method: 'method',
  status: 'status',
  amount: 'amount',
  currency: 'currency',
  providerOrderId: 'providerOrderId',
  providerPaymentKey: 'providerPaymentKey',
  providerReference: 'providerReference',
  approvedAt: 'approvedAt',
  failedAt: 'failedAt',
  cancelledAt: 'cancelledAt',
  failureCode: 'failureCode',
  failureMessage: 'failureMessage',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ReceiptScalarFieldEnum = {
  id: 'id',
  receiptNo: 'receiptNo',
  paymentId: 'paymentId',
  invoiceId: 'invoiceId',
  sessionId: 'sessionId',
  issuedByUserId: 'issuedByUserId',
  ownerUserId: 'ownerUserId',
  ownerPhone: 'ownerPhone',
  ownerName: 'ownerName',
  status: 'status',
  supplyAmount: 'supplyAmount',
  taxAmount: 'taxAmount',
  totalAmount: 'totalAmount',
  issuedAt: 'issuedAt',
  cancelledAt: 'cancelledAt',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EntryRecordScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  vehicleId: 'vehicleId',
  parkingSpaceId: 'parkingSpaceId',
  enteredAt: 'enteredAt',
  createdAt: 'createdAt'
};

exports.Prisma.ExitRecordScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  vehicleId: 'vehicleId',
  parkingSpaceId: 'parkingSpaceId',
  fee: 'fee',
  exitedAt: 'exitedAt',
  createdAt: 'createdAt'
};

exports.Prisma.FeeScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  baseAmount: 'baseAmount',
  perHour: 'perHour',
  maxDaily: 'maxDaily',
  vehicleType: 'vehicleType',
  parkingLotId: 'parkingLotId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.FeePolicyScalarFieldEnum = {
  id: 'id',
  parkingLotId: 'parkingLotId',
  code: 'code',
  name: 'name',
  vehicleType: 'vehicleType',
  baseMinutes: 'baseMinutes',
  baseFee: 'baseFee',
  unitMinutes: 'unitMinutes',
  unitFee: 'unitFee',
  memberDiscountPercent: 'memberDiscountPercent',
  dailyMax: 'dailyMax',
  graceMinutes: 'graceMinutes',
  exitGraceMinutes: 'exitGraceMinutes',
  registrationGraceMinutes: 'registrationGraceMinutes',
  registrationGraceFee: 'registrationGraceFee',
  registrationGraceDiscountEnabled: 'registrationGraceDiscountEnabled',
  authorityRegistrationGraceDiscountEnabled: 'authorityRegistrationGraceDiscountEnabled',
  watcherRewardGraceFeeEnabled: 'watcherRewardGraceFeeEnabled',
  isActive: 'isActive',
  validFrom: 'validFrom',
  validTo: 'validTo',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.FeePolicyTimeRuleScalarFieldEnum = {
  id: 'id',
  feePolicyId: 'feePolicyId',
  startHour: 'startHour',
  endHour: 'endHour',
  multiplier: 'multiplier'
};

exports.Prisma.DiscountProgramScalarFieldEnum = {
  id: 'id',
  name: 'name',
  percentage: 'percentage',
  isActive: 'isActive',
  feeId: 'feeId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MonthlySubscriptionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  parkingLotId: 'parkingLotId',
  vehicleNumber: 'vehicleNumber',
  startDate: 'startDate',
  endDate: 'endDate',
  isActive: 'isActive',
  createdAt: 'createdAt'
};

exports.Prisma.CouponScalarFieldEnum = {
  id: 'id',
  code: 'code',
  discountType: 'discountType',
  value: 'value',
  expiresAt: 'expiresAt',
  usageLimit: 'usageLimit',
  usedCount: 'usedCount',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.MonthlyChargeScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  parkingLotId: 'parkingLotId',
  amount: 'amount',
  status: 'status',
  billingMonth: 'billingMonth',
  note: 'note',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SessionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  deviceId: 'deviceId',
  userAgent: 'userAgent',
  ip: 'ip',
  refreshTokenHash: 'refreshTokenHash',
  createdAt: 'createdAt',
  lastUsedAt: 'lastUsedAt'
};

exports.Prisma.UserDeviceScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  userAgent: 'userAgent',
  ip: 'ip',
  deviceName: 'deviceName',
  platform: 'platform',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SensorDeviceScalarFieldEnum = {
  id: 'id',
  name: 'name',
  type: 'type',
  serialNumber: 'serialNumber',
  devEui: 'devEui',
  macAddress: 'macAddress',
  ipAddress: 'ipAddress',
  installLocation: 'installLocation',
  status: 'status',
  parkingLotId: 'parkingLotId',
  parkingSectionId: 'parkingSectionId',
  parkingSpaceId: 'parkingSpaceId',
  firmwareVersion: 'firmwareVersion',
  lastSeenAt: 'lastSeenAt',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SensorEventScalarFieldEnum = {
  id: 'id',
  sensorDeviceId: 'sensorDeviceId',
  eventType: 'eventType',
  payload: 'payload',
  receivedAt: 'receivedAt',
  publishStatus: 'publishStatus'
};

exports.Prisma.DomainEventScalarFieldEnum = {
  id: 'id',
  eventId: 'eventId',
  aggregateType: 'aggregateType',
  aggregateId: 'aggregateId',
  eventType: 'eventType',
  eventVersion: 'eventVersion',
  payload: 'payload',
  occurredAt: 'occurredAt',
  createdAt: 'createdAt',
  publishStatus: 'publishStatus'
};

exports.Prisma.SyncOutboxScalarFieldEnum = {
  id: 'id',
  domainEventId: 'domainEventId',
  destination: 'destination',
  status: 'status',
  retryCount: 'retryCount',
  nextRetryAt: 'nextRetryAt',
  lastError: 'lastError',
  sentAt: 'sentAt',
  ackedAt: 'ackedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AuditLogScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  action: 'action',
  entity: 'entity',
  entityId: 'entityId',
  meta: 'meta',
  createdAt: 'createdAt'
};

exports.Prisma.SubscriptionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  parkingLotId: 'parkingLotId',
  isActive: 'isActive',
  vehicleId: 'vehicleId',
  planName: 'planName',
  amount: 'amount',
  startDate: 'startDate',
  endDate: 'endDate',
  status: 'status',
  autoRenew: 'autoRenew',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.OutstandingScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  invoiceId: 'invoiceId',
  sessionId: 'sessionId',
  amount: 'amount',
  reason: 'reason',
  status: 'status',
  dueAt: 'dueAt',
  resolvedAt: 'resolvedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DailySettlementScalarFieldEnum = {
  id: 'id',
  parkingLotId: 'parkingLotId',
  businessDate: 'businessDate',
  totalInvoice: 'totalInvoice',
  totalPaid: 'totalPaid',
  totalRefunded: 'totalRefunded',
  totalOutstanding: 'totalOutstanding',
  status: 'status',
  closedAt: 'closedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.UserVehicleScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  vehicleId: 'vehicleId',
  isPrimary: 'isPrimary',
  createdAt: 'createdAt'
};

exports.Prisma.DeviceFaultScalarFieldEnum = {
  id: 'id',
  sensorDeviceId: 'sensorDeviceId',
  devEui: 'devEui',
  name: 'name',
  parkingSpaceId: 'parkingSpaceId',
  title: 'title',
  description: 'description',
  code: 'code',
  severity: 'severity',
  status: 'status',
  detectedAt: 'detectedAt',
  assignedToUserId: 'assignedToUserId',
  actionTaken: 'actionTaken',
  actionResult: 'actionResult',
  resolvedAt: 'resolvedAt',
  closedAt: 'closedAt',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PushNotificationScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  title: 'title',
  body: 'body',
  data: 'data',
  status: 'status',
  sentAt: 'sentAt',
  readAt: 'readAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ApprovalRequestScalarFieldEnum = {
  id: 'id',
  type: 'type',
  status: 'status',
  requesterId: 'requesterId',
  companyName: 'companyName',
  requestedParkingLotName: 'requestedParkingLotName',
  requestedParkingLotId: 'requestedParkingLotId',
  requestedSectionId: 'requestedSectionId',
  tenantId: 'tenantId',
  memo: 'memo',
  requestData: 'requestData',
  reviewedById: 'reviewedById',
  reviewedAt: 'reviewedAt',
  rejectionReason: 'rejectionReason',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  parkingLotId: 'parkingLotId',
  parkingSectionId: 'parkingSectionId'
};

exports.Prisma.PushTokenScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  token: 'token',
  platform: 'platform',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DisplayBoardScalarFieldEnum = {
  id: 'id',
  parkingLotId: 'parkingLotId',
  name: 'name',
  code: 'code',
  deviceId: 'deviceId',
  macAddress: 'macAddress',
  enabled: 'enabled',
  transport: 'transport',
  tcpHost: 'tcpHost',
  tcpPort: 'tcpPort',
  serialPort: 'serialPort',
  baudRate: 'baudRate',
  dataBits: 'dataBits',
  parity: 'parity',
  stopBits: 'stopBits',
  connectTimeoutMs: 'connectTimeoutMs',
  readTimeoutMs: 'readTimeoutMs',
  rows: 'rows',
  cols: 'cols',
  moduleType: 'moduleType',
  rgbOrder: 'rgbOrder',
  brightness: 'brightness',
  powerOn: 'powerOn',
  mode: 'mode',
  manualReason: 'manualReason',
  manualExpiresAt: 'manualExpiresAt',
  heartbeatIntervalSec: 'heartbeatIntervalSec',
  retryMaxAttempts: 'retryMaxAttempts',
  retryBackoffMs: 'retryBackoffMs',
  lastHeartbeatAt: 'lastHeartbeatAt',
  lastStatus: 'lastStatus',
  lastError: 'lastError',
  lastRenderedPayload: 'lastRenderedPayload',
  lastSentPayload: 'lastSentPayload',
  lastResponseHex: 'lastResponseHex',
  lastSentAt: 'lastSentAt',
  lastAckAt: 'lastAckAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DisplayBoardLineScalarFieldEnum = {
  id: 'id',
  displayBoardId: 'displayBoardId',
  source: 'source',
  lineNo: 'lineNo',
  textTemplate: 'textTemplate',
  enabled: 'enabled',
  fontSize: 'fontSize',
  effect: 'effect',
  speed: 'speed',
  delay: 'delay',
  neon: 'neon',
  fix: 'fix',
  colorCode: 'colorCode',
  fontCode: 'fontCode',
  widthCode: 'widthCode',
  attributeCode: 'attributeCode',
  iconCode: 'iconCode',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DisplayCommandScalarFieldEnum = {
  id: 'id',
  displayBoardId: 'displayBoardId',
  type: 'type',
  payload: 'payload',
  status: 'status',
  packetHex: 'packetHex',
  responseHex: 'responseHex',
  errorMessage: 'errorMessage',
  requestedByUserId: 'requestedByUserId',
  requestedAt: 'requestedAt',
  processingAt: 'processingAt',
  sentAt: 'sentAt',
  ackedAt: 'ackedAt',
  failedAt: 'failedAt',
  attempts: 'attempts',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DisplayHeartbeatLogScalarFieldEnum = {
  id: 'id',
  displayBoardId: 'displayBoardId',
  status: 'status',
  transport: 'transport',
  lastDisplayedState: 'lastDisplayedState',
  errorDetails: 'errorDetails',
  receivedAt: 'receivedAt'
};

exports.Prisma.ColorPresetScalarFieldEnum = {
  id: 'id',
  code: 'code',
  label: 'label'
};

exports.Prisma.TextAttributeScalarFieldEnum = {
  id: 'id',
  code: 'code',
  label: 'label'
};

exports.Prisma.FontPresetScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name'
};

exports.Prisma.WidthPresetScalarFieldEnum = {
  id: 'id',
  code: 'code',
  label: 'label'
};

exports.Prisma.IconPresetScalarFieldEnum = {
  id: 'id',
  code: 'code',
  label: 'label'
};

exports.Prisma.EffectPresetScalarFieldEnum = {
  id: 'id',
  xx: 'xx',
  yy: 'yy',
  label: 'label'
};

exports.Prisma.Kosmos_tracker_dataScalarFieldEnum = {
  id: 'id',
  dev_eui: 'dev_eui',
  gateway_id: 'gateway_id',
  time: 'time',
  dr: 'dr',
  fcnt: 'fcnt',
  fport: 'fport',
  rssi: 'rssi',
  snr: 'snr',
  channel: 'channel',
  battery_status: 'battery_status',
  device_status: 'device_status',
  latitude_deg: 'latitude_deg',
  longitude_deg: 'longitude_deg',
  created_at: 'created_at',
  battery_voltage: 'battery_voltage',
  sensor_info: 'sensor_info',
  firmware_version: 'firmware_version'
};

exports.Prisma.Parking_sensor_dataScalarFieldEnum = {
  id: 'id',
  dev_eui: 'dev_eui',
  gateway_id: 'gateway_id',
  time: 'time',
  dr: 'dr',
  fcnt: 'fcnt',
  fport: 'fport',
  rssi: 'rssi',
  snr: 'snr',
  channel: 'channel',
  battery_status: 'battery_status',
  device_status: 'device_status',
  parking_status: 'parking_status',
  firmware_version: 'firmware_version',
  created_at: 'created_at',
  battery_voltage: 'battery_voltage'
};

exports.Prisma.Parking_stateScalarFieldEnum = {
  dev_eui: 'dev_eui',
  parking_status: 'parking_status',
  state_since: 'state_since',
  last_message_time: 'last_message_time',
  rssi: 'rssi',
  snr: 'snr',
  battery_voltage: 'battery_voltage'
};

exports.Prisma.Sensio_env_dataScalarFieldEnum = {
  id: 'id',
  dev_eui: 'dev_eui',
  gateway_id: 'gateway_id',
  time: 'time',
  dr: 'dr',
  fcnt: 'fcnt',
  fport: 'fport',
  rssi: 'rssi',
  snr: 'snr',
  channel: 'channel',
  temperature_c: 'temperature_c',
  humidity_percent: 'humidity_percent',
  pm1_0_ug_m3: 'pm1_0_ug_m3',
  pm2_5_ug_m3: 'pm2_5_ug_m3',
  pm10_ug_m3: 'pm10_ug_m3',
  battery_state: 'battery_state',
  comm_env_ok: 'comm_env_ok',
  device_ok: 'device_ok',
  sensor_ok: 'sensor_ok',
  created_at: 'created_at'
};

exports.Prisma.Slot_mappingScalarFieldEnum = {
  slot_id: 'slot_id',
  slot_label: 'slot_label',
  dev_eui: 'dev_eui'
};

exports.Prisma.UserBlacklistScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  reason: 'reason',
  isActive: 'isActive',
  createdAt: 'createdAt'
};

exports.Prisma.TenantScalarFieldEnum = {
  id: 'id',
  name: 'name',
  code: 'code',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DeviceScalarFieldEnum = {
  id: 'id',
  name: 'name',
  serialNumber: 'serialNumber',
  devEui: 'devEui',
  macAddress: 'macAddress',
  ipAddress: 'ipAddress',
  installLocation: 'installLocation',
  type: 'type',
  status: 'status',
  parkingLotId: 'parkingLotId',
  parkingSectionId: 'parkingSectionId',
  parkingSpaceId: 'parkingSpaceId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.DeviceEventScalarFieldEnum = {
  id: 'id',
  deviceId: 'deviceId',
  devEui: 'devEui',
  parkingLotId: 'parkingLotId',
  parkingSectionId: 'parkingSectionId',
  parkingSpaceId: 'parkingSpaceId',
  source: 'source',
  eventType: 'eventType',
  parkingStatus: 'parkingStatus',
  deviceStatus: 'deviceStatus',
  batteryStatus: 'batteryStatus',
  batteryVoltage: 'batteryVoltage',
  firmwareVersion: 'firmwareVersion',
  gatewayId: 'gatewayId',
  rssi: 'rssi',
  snr: 'snr',
  channel: 'channel',
  fCnt: 'fCnt',
  fPort: 'fPort',
  dr: 'dr',
  rawPayload: 'rawPayload',
  parsedPayload: 'parsedPayload',
  occurredAt: 'occurredAt',
  receivedAt: 'receivedAt'
};

exports.Prisma.EmailVerificationTokenScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  email: 'email',
  tokenHash: 'tokenHash',
  expiresAt: 'expiresAt',
  usedAt: 'usedAt',
  createdAt: 'createdAt'
};

exports.Prisma.PasswordResetTokenScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  email: 'email',
  tokenHash: 'tokenHash',
  expiresAt: 'expiresAt',
  usedAt: 'usedAt',
  createdAt: 'createdAt'
};

exports.Prisma.PasswordHistoryScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  passwordHash: 'passwordHash',
  createdAt: 'createdAt'
};

exports.Prisma.LoginAttemptScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  email: 'email',
  success: 'success',
  reason: 'reason',
  ip: 'ip',
  userAgent: 'userAgent',
  createdAt: 'createdAt'
};

exports.Prisma.ApiKeyScalarFieldEnum = {
  id: 'id',
  ownerType: 'ownerType',
  ownerId: 'ownerId',
  keyId: 'keyId',
  keyHash: 'keyHash',
  name: 'name',
  scopes: 'scopes',
  expiresAt: 'expiresAt',
  revokedAt: 'revokedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EdgeNodeScalarFieldEnum = {
  id: 'id',
  code: 'code',
  name: 'name',
  tenantId: 'tenantId',
  status: 'status',
  appVersion: 'appVersion',
  lastSeenAt: 'lastSeenAt',
  lastConnectedAt: 'lastConnectedAt',
  lastSyncAt: 'lastSyncAt',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EdgeNodeKeyScalarFieldEnum = {
  id: 'id',
  edgeNodeId: 'edgeNodeId',
  keyId: 'keyId',
  keyHash: 'keyHash',
  publicKey: 'publicKey',
  isActive: 'isActive',
  expiresAt: 'expiresAt',
  revokedAt: 'revokedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EdgeParkingLotScalarFieldEnum = {
  id: 'id',
  edgeNodeId: 'edgeNodeId',
  parkingLotId: 'parkingLotId',
  isPrimary: 'isPrimary',
  createdAt: 'createdAt'
};

exports.Prisma.SyncInboxScalarFieldEnum = {
  id: 'id',
  messageId: 'messageId',
  source: 'source',
  eventType: 'eventType',
  eventVersion: 'eventVersion',
  aggregateType: 'aggregateType',
  aggregateId: 'aggregateId',
  payload: 'payload',
  status: 'status',
  receivedAt: 'receivedAt',
  processedAt: 'processedAt',
  failedAt: 'failedAt',
  error: 'error'
};

exports.Prisma.SyncCursorScalarFieldEnum = {
  id: 'id',
  edgeNodeId: 'edgeNodeId',
  direction: 'direction',
  stream: 'stream',
  lastSequence: 'lastSequence',
  lastMessageId: 'lastMessageId',
  lastSyncedAt: 'lastSyncedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SyncConflictScalarFieldEnum = {
  id: 'id',
  messageId: 'messageId',
  aggregateType: 'aggregateType',
  aggregateId: 'aggregateId',
  conflictType: 'conflictType',
  status: 'status',
  localPayload: 'localPayload',
  remotePayload: 'remotePayload',
  resolution: 'resolution',
  detectedAt: 'detectedAt',
  resolvedAt: 'resolvedAt',
  resolvedByUserId: 'resolvedByUserId'
};

exports.Prisma.SensorEventLogScalarFieldEnum = {
  id: 'id',
  devEui: 'devEui',
  deviceId: 'deviceId',
  parkingSpaceId: 'parkingSpaceId',
  source: 'source',
  eventType: 'eventType',
  parkingStatus: 'parkingStatus',
  deviceStatus: 'deviceStatus',
  batteryStatus: 'batteryStatus',
  batteryVoltage: 'batteryVoltage',
  firmwareVersion: 'firmwareVersion',
  gatewayId: 'gatewayId',
  rssi: 'rssi',
  snr: 'snr',
  channel: 'channel',
  fCnt: 'fCnt',
  fPort: 'fPort',
  dr: 'dr',
  rawPayload: 'rawPayload',
  parsedPayload: 'parsedPayload',
  occurredAt: 'occurredAt',
  createdAt: 'createdAt'
};

exports.Prisma.DisplayBoardModuleScalarFieldEnum = {
  id: 'id',
  displayBoardId: 'displayBoardId',
  rowNo: 'rowNo',
  colNo: 'colNo',
  parkingSectionId: 'parkingSectionId',
  label: 'label',
  enabled: 'enabled',
  charWidth: 'charWidth',
  padChar: 'padChar',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TenantUserScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  userId: 'userId',
  role: 'role',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ParkingLotPhotoScalarFieldEnum = {
  id: 'id',
  parkingLotId: 'parkingLotId',
  imageUrl: 'imageUrl',
  sortOrder: 'sortOrder',
  isPrimary: 'isPrimary',
  createdAt: 'createdAt'
};

exports.Prisma.ParkingLotQrScalarFieldEnum = {
  id: 'id',
  parkingLotId: 'parkingLotId',
  qrToken: 'qrToken',
  qrType: 'qrType',
  isActive: 'isActive',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.FavoriteParkingLotScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  parkingLotId: 'parkingLotId',
  createdAt: 'createdAt'
};

exports.Prisma.ParkingRegistrationPhotoScalarFieldEnum = {
  id: 'id',
  parkingSessionId: 'parkingSessionId',
  imageUrl: 'imageUrl',
  photoType: 'photoType',
  required: 'required',
  capturedByUserId: 'capturedByUserId',
  capturedByRole: 'capturedByRole',
  createdAt: 'createdAt'
};

exports.Prisma.WatcherApplicationScalarFieldEnum = {
  id: 'id',
  watcherUserId: 'watcherUserId',
  parkingLotId: 'parkingLotId',
  status: 'status',
  requestedAt: 'requestedAt',
  approvedByUserId: 'approvedByUserId',
  approvedAt: 'approvedAt',
  rejectedByUserId: 'rejectedByUserId',
  rejectedAt: 'rejectedAt',
  rejectedReason: 'rejectedReason',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.WatcherLotBindingScalarFieldEnum = {
  id: 'id',
  watcherUserId: 'watcherUserId',
  parkingLotId: 'parkingLotId',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EnforcementCaseScalarFieldEnum = {
  id: 'id',
  parkingLotId: 'parkingLotId',
  parkingSectionId: 'parkingSectionId',
  parkingSpaceId: 'parkingSpaceId',
  parkingSessionId: 'parkingSessionId',
  reason: 'reason',
  status: 'status',
  graceMinutes: 'graceMinutes',
  detectedAt: 'detectedAt',
  assignedToUserId: 'assignedToUserId',
  resolvedByUserId: 'resolvedByUserId',
  resolvedAt: 'resolvedAt',
  note: 'note',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RegistrationProxyLogScalarFieldEnum = {
  id: 'id',
  parkingSessionId: 'parkingSessionId',
  performedByUserId: 'performedByUserId',
  performedByRole: 'performedByRole',
  vehiclePlateNumber: 'vehiclePlateNumber',
  contactPhone: 'contactPhone',
  note: 'note',
  photoRequired: 'photoRequired',
  createdAt: 'createdAt',
  reviewStatus: 'reviewStatus',
  reviewedByUserId: 'reviewedByUserId',
  reviewedAt: 'reviewedAt',
  reviewNote: 'reviewNote',
  correctedVehiclePlateNumber: 'correctedVehiclePlateNumber',
  correctedContactPhone: 'correctedContactPhone',
  correctionNote: 'correctionNote',
  correctedByUserId: 'correctedByUserId',
  correctedAt: 'correctedAt'
};

exports.Prisma.InvoiceManualPaymentScalarFieldEnum = {
  id: 'id',
  invoiceId: 'invoiceId',
  amount: 'amount',
  paymentMethod: 'paymentMethod',
  collectedByUserId: 'collectedByUserId',
  collectedAt: 'collectedAt',
  note: 'note',
  createdAt: 'createdAt'
};

exports.Prisma.PlateRecognitionResultScalarFieldEnum = {
  id: 'id',
  parkingSessionId: 'parkingSessionId',
  enforcementCaseId: 'enforcementCaseId',
  registrationProxyLogId: 'registrationProxyLogId',
  imageUrl: 'imageUrl',
  provider: 'provider',
  mode: 'mode',
  country: 'country',
  suggestedPlateNumber: 'suggestedPlateNumber',
  reviewedPlateNumber: 'reviewedPlateNumber',
  confidence: 'confidence',
  candidates: 'candidates',
  rawResponse: 'rawResponse',
  createdByUserId: 'createdByUserId',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AuthorityRegistrationCorrectionHistoryScalarFieldEnum = {
  id: 'id',
  registrationProxyLogId: 'registrationProxyLogId',
  parkingSessionId: 'parkingSessionId',
  correctedByUserId: 'correctedByUserId',
  previousPlateNumber: 'previousPlateNumber',
  newPlateNumber: 'newPlateNumber',
  previousContactPhone: 'previousContactPhone',
  newContactPhone: 'newContactPhone',
  correctionNote: 'correctionNote',
  createdAt: 'createdAt'
};

exports.Prisma.AuthorityRegistrationReviewHistoryScalarFieldEnum = {
  id: 'id',
  registrationProxyLogId: 'registrationProxyLogId',
  reviewedByUserId: 'reviewedByUserId',
  previousStatus: 'previousStatus',
  newStatus: 'newStatus',
  reviewNote: 'reviewNote',
  createdAt: 'createdAt'
};

exports.Prisma.ControlServiceScalarFieldEnum = {
  id: 'id',
  key: 'key',
  name: 'name',
  description: 'description',
  host: 'host',
  port: 'port',
  commandType: 'commandType',
  targetName: 'targetName',
  enabled: 'enabled',
  sortOrder: 'sortOrder',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.UserStatus = exports.$Enums.UserStatus = {
  PENDING_EMAIL_VERIFICATION: 'PENDING_EMAIL_VERIFICATION',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  LOCKED: 'LOCKED',
  DELETED: 'DELETED'
};

exports.ScopeType = exports.$Enums.ScopeType = {
  GLOBAL: 'GLOBAL',
  TENANT: 'TENANT',
  EDGE: 'EDGE',
  LOT: 'LOT',
  SECTION: 'SECTION',
  SPACE: 'SPACE',
  SELF: 'SELF'
};

exports.SpaceType = exports.$Enums.SpaceType = {
  REGULAR: 'REGULAR',
  EV: 'EV',
  HANDICAPPED: 'HANDICAPPED',
  PREGNANT: 'PREGNANT',
  COMPACT: 'COMPACT',
  VIP: 'VIP',
  RESERVED: 'RESERVED'
};

exports.SpaceStatus = exports.$Enums.SpaceStatus = {
  EMPTY: 'EMPTY',
  OCCUPIED: 'OCCUPIED',
  RESERVED: 'RESERVED',
  DISABLED: 'DISABLED',
  UNKNOWN: 'UNKNOWN'
};

exports.SessionType = exports.$Enums.SessionType = {
  HOURLY: 'HOURLY',
  DAILY: 'DAILY',
  SUBSCRIPTION: 'SUBSCRIPTION',
  FREE: 'FREE',
  EV_CHARGING: 'EV_CHARGING',
  VIP: 'VIP'
};

exports.SessionStatus = exports.$Enums.SessionStatus = {
  CREATED: 'CREATED',
  ACTIVE: 'ACTIVE',
  GRACE_PERIOD: 'GRACE_PERIOD',
  CLOSED: 'CLOSED',
  PAID: 'PAID',
  LOST: 'LOST',
  CANCELLED: 'CANCELLED'
};

exports.RegistrationStatus = exports.$Enums.RegistrationStatus = {
  UNREGISTERED: 'UNREGISTERED',
  REGISTERED_BY_MEMBER: 'REGISTERED_BY_MEMBER',
  REGISTERED_BY_VISITOR: 'REGISTERED_BY_VISITOR',
  REGISTERED_BY_WATCHER: 'REGISTERED_BY_WATCHER',
  REGISTERED_BY_OPERATOR: 'REGISTERED_BY_OPERATOR',
  REGISTERED_BY_MANAGER: 'REGISTERED_BY_MANAGER',
  REGISTERED_BY_ADMIN: 'REGISTERED_BY_ADMIN'
};

exports.RegistrationMethod = exports.$Enums.RegistrationMethod = {
  MEMBER_QR: 'MEMBER_QR',
  VISITOR_QR: 'VISITOR_QR',
  WATCHER_PROXY: 'WATCHER_PROXY',
  OPERATOR_MANUAL: 'OPERATOR_MANUAL',
  MANAGER_MANUAL: 'MANAGER_MANUAL',
  ADMIN_MANUAL: 'ADMIN_MANUAL'
};

exports.InvoiceStatus = exports.$Enums.InvoiceStatus = {
  DRAFT: 'DRAFT',
  ISSUED: 'ISSUED',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  VOID: 'VOID',
  CANCELLED: 'CANCELLED'
};

exports.PaymentMethod = exports.$Enums.PaymentMethod = {
  CARD: 'CARD',
  CASH: 'CASH',
  MOBILE: 'MOBILE',
  TOSS: 'TOSS'
};

exports.PaymentStatus = exports.$Enums.PaymentStatus = {
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED'
};

exports.ReceiptStatus = exports.$Enums.ReceiptStatus = {
  ISSUED: 'ISSUED',
  CANCELLED: 'CANCELLED'
};

exports.DiscountType = exports.$Enums.DiscountType = {
  PERCENT: 'PERCENT',
  FIXED: 'FIXED'
};

exports.DeviceStatus = exports.$Enums.DeviceStatus = {
  ACTIVE: 'ACTIVE',
  OFFLINE: 'OFFLINE',
  FAULT: 'FAULT',
  MAINTENANCE: 'MAINTENANCE'
};

exports.EventPublishStatus = exports.$Enums.EventPublishStatus = {
  NEW: 'NEW',
  PROCESSED: 'PROCESSED',
  FAILED: 'FAILED'
};

exports.SyncStatus = exports.$Enums.SyncStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  ACKED: 'ACKED'
};

exports.SubscriptionStatus = exports.$Enums.SubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED'
};

exports.SettlementStatus = exports.$Enums.SettlementStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED'
};

exports.FaultSeverity = exports.$Enums.FaultSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

exports.FaultStatus = exports.$Enums.FaultStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED'
};

exports.PushNotificationStatus = exports.$Enums.PushNotificationStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  READ: 'READ'
};

exports.ApprovalRequestType = exports.$Enums.ApprovalRequestType = {
  MANAGER_LOT_ACCESS: 'MANAGER_LOT_ACCESS',
  OPERATOR_SECTION_ACCESS: 'OPERATOR_SECTION_ACCESS',
  MANAGER_REGISTRATION: 'MANAGER_REGISTRATION',
  MANAGER_SCOPE_ACCESS: 'MANAGER_SCOPE_ACCESS',
  OPERATOR_REGISTRATION: 'OPERATOR_REGISTRATION',
  OPERATOR_SCOPE_ACCESS: 'OPERATOR_SCOPE_ACCESS',
  PARKING_LOT_ACCESS: 'PARKING_LOT_ACCESS',
  PARKING_LOT_CREATION: 'PARKING_LOT_CREATION'
};

exports.ApprovalStatus = exports.$Enums.ApprovalStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
};

exports.DisplayTransportType = exports.$Enums.DisplayTransportType = {
  TCP: 'TCP',
  RS232: 'RS232',
  RS485: 'RS485'
};

exports.DisplayMode = exports.$Enums.DisplayMode = {
  AUTO: 'AUTO',
  MANUAL: 'MANUAL'
};

exports.DisplayBoardStatus = exports.$Enums.DisplayBoardStatus = {
  OK: 'OK',
  WARN: 'WARN',
  ERROR: 'ERROR',
  OFFLINE: 'OFFLINE'
};

exports.DisplayLineSource = exports.$Enums.DisplayLineSource = {
  AUTO: 'AUTO',
  MANUAL: 'MANUAL'
};

exports.DisplayCommandStatus = exports.$Enums.DisplayCommandStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SENT: 'SENT',
  ACKED: 'ACKED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED'
};

exports.DeviceType = exports.$Enums.DeviceType = {
  PARKING_SENSOR: 'PARKING_SENSOR',
  IO_CONTROLLER: 'IO_CONTROLLER',
  DISPLAY_BOARD: 'DISPLAY_BOARD',
  SMART_TRACKER: 'SMART_TRACKER',
  SENSIO_CONTROLLER: 'SENSIO_CONTROLLER'
};

exports.RegistrationPhotoType = exports.$Enums.RegistrationPhotoType = {
  VEHICLE_PLATE: 'VEHICLE_PLATE',
  PARKING_SPACE: 'PARKING_SPACE',
  DISPUTE_EVIDENCE: 'DISPUTE_EVIDENCE'
};

exports.WatcherApplicationStatus = exports.$Enums.WatcherApplicationStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED'
};

exports.EnforcementReason = exports.$Enums.EnforcementReason = {
  UNREGISTERED_AFTER_GRACE: 'UNREGISTERED_AFTER_GRACE',
  SENSOR_ERROR: 'SENSOR_ERROR',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  MANUAL_REVIEW: 'MANUAL_REVIEW'
};

exports.EnforcementCaseStatus = exports.$Enums.EnforcementCaseStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  REGISTERED: 'REGISTERED',
  PAID: 'PAID',
  DISMISSED: 'DISMISSED',
  RESOLVED: 'RESOLVED'
};

exports.AuthorityRegistrationReviewStatus = exports.$Enums.AuthorityRegistrationReviewStatus = {
  PENDING_REVIEW: 'PENDING_REVIEW',
  REVIEWED: 'REVIEWED',
  NEEDS_CORRECTION: 'NEEDS_CORRECTION',
  REJECTED: 'REJECTED'
};

exports.Prisma.ModelName = {
  User: 'User',
  Role: 'Role',
  UserRole: 'UserRole',
  Permission: 'Permission',
  RolePermission: 'RolePermission',
  AppMenu: 'AppMenu',
  AppPage: 'AppPage',
  PageAction: 'PageAction',
  MenuPolicy: 'MenuPolicy',
  RoleMenuPolicy: 'RoleMenuPolicy',
  RolePagePolicy: 'RolePagePolicy',
  UserScopeBinding: 'UserScopeBinding',
  Vehicle: 'Vehicle',
  MemberProfile: 'MemberProfile',
  VisitorProfile: 'VisitorProfile',
  ManagerProfile: 'ManagerProfile',
  OperatorProfile: 'OperatorProfile',
  ParkingLot: 'ParkingLot',
  ParkingSection: 'ParkingSection',
  ParkingSpaceTypeStyle: 'ParkingSpaceTypeStyle',
  ParkingSpace: 'ParkingSpace',
  ManagerParkingLot: 'ManagerParkingLot',
  OperatorParkingSection: 'OperatorParkingSection',
  ParkingSession: 'ParkingSession',
  ParkingSessionEvent: 'ParkingSessionEvent',
  Invoice: 'Invoice',
  Payment: 'Payment',
  PaymentTransaction: 'PaymentTransaction',
  Receipt: 'Receipt',
  EntryRecord: 'EntryRecord',
  ExitRecord: 'ExitRecord',
  Fee: 'Fee',
  FeePolicy: 'FeePolicy',
  FeePolicyTimeRule: 'FeePolicyTimeRule',
  DiscountProgram: 'DiscountProgram',
  MonthlySubscription: 'MonthlySubscription',
  Coupon: 'Coupon',
  MonthlyCharge: 'MonthlyCharge',
  Session: 'Session',
  UserDevice: 'UserDevice',
  SensorDevice: 'SensorDevice',
  SensorEvent: 'SensorEvent',
  DomainEvent: 'DomainEvent',
  SyncOutbox: 'SyncOutbox',
  AuditLog: 'AuditLog',
  Subscription: 'Subscription',
  Outstanding: 'Outstanding',
  DailySettlement: 'DailySettlement',
  UserVehicle: 'UserVehicle',
  DeviceFault: 'DeviceFault',
  PushNotification: 'PushNotification',
  ApprovalRequest: 'ApprovalRequest',
  PushToken: 'PushToken',
  DisplayBoard: 'DisplayBoard',
  DisplayBoardLine: 'DisplayBoardLine',
  DisplayCommand: 'DisplayCommand',
  DisplayHeartbeatLog: 'DisplayHeartbeatLog',
  ColorPreset: 'ColorPreset',
  TextAttribute: 'TextAttribute',
  FontPreset: 'FontPreset',
  WidthPreset: 'WidthPreset',
  IconPreset: 'IconPreset',
  EffectPreset: 'EffectPreset',
  kosmos_tracker_data: 'kosmos_tracker_data',
  parking_sensor_data: 'parking_sensor_data',
  parking_state: 'parking_state',
  sensio_env_data: 'sensio_env_data',
  slot_mapping: 'slot_mapping',
  UserBlacklist: 'UserBlacklist',
  Tenant: 'Tenant',
  Device: 'Device',
  DeviceEvent: 'DeviceEvent',
  EmailVerificationToken: 'EmailVerificationToken',
  PasswordResetToken: 'PasswordResetToken',
  PasswordHistory: 'PasswordHistory',
  LoginAttempt: 'LoginAttempt',
  ApiKey: 'ApiKey',
  EdgeNode: 'EdgeNode',
  EdgeNodeKey: 'EdgeNodeKey',
  EdgeParkingLot: 'EdgeParkingLot',
  SyncInbox: 'SyncInbox',
  SyncCursor: 'SyncCursor',
  SyncConflict: 'SyncConflict',
  SensorEventLog: 'SensorEventLog',
  DisplayBoardModule: 'DisplayBoardModule',
  TenantUser: 'TenantUser',
  ParkingLotPhoto: 'ParkingLotPhoto',
  ParkingLotQr: 'ParkingLotQr',
  FavoriteParkingLot: 'FavoriteParkingLot',
  ParkingRegistrationPhoto: 'ParkingRegistrationPhoto',
  WatcherApplication: 'WatcherApplication',
  WatcherLotBinding: 'WatcherLotBinding',
  EnforcementCase: 'EnforcementCase',
  RegistrationProxyLog: 'RegistrationProxyLog',
  InvoiceManualPayment: 'InvoiceManualPayment',
  PlateRecognitionResult: 'PlateRecognitionResult',
  AuthorityRegistrationCorrectionHistory: 'AuthorityRegistrationCorrectionHistory',
  AuthorityRegistrationReviewHistory: 'AuthorityRegistrationReviewHistory',
  ControlService: 'ControlService'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
