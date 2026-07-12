-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "ScopeType" AS ENUM ('GLOBAL', 'LOT', 'SECTION', 'SPACE', 'SELF');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('CREATED', 'ACTIVE', 'GRACE_PERIOD', 'CLOSED', 'PAID', 'LOST', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('HOURLY', 'DAILY', 'SUBSCRIPTION', 'FREE', 'EV_CHARGING', 'VIP');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'CASH', 'MOBILE', 'TOSS');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'VOID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "SpaceStatus" AS ENUM ('EMPTY', 'OCCUPIED', 'RESERVED', 'DISABLED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SpaceType" AS ENUM ('REGULAR', 'EV', 'HANDICAPPED', 'COMPACT', 'VIP', 'RESERVED');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'OFFLINE', 'FAULT', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "EventPublishStatus" AS ENUM ('NEW', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'ACKED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "FaultStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "FaultSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "PushNotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "ApprovalRequestType" AS ENUM ('MANAGER_LOT_ACCESS', 'OPERATOR_SECTION_ACCESS', 'MANAGER_REGISTRATION', 'MANAGER_SCOPE_ACCESS', 'OPERATOR_REGISTRATION', 'OPERATOR_SCOPE_ACCESS');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('ISSUED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DisplayControllerMode" AS ENUM ('WS', 'MQTT', 'REST');

-- CreateEnum
CREATE TYPE "DisplayProtocol" AS ENUM ('TCP', 'MODBUS_TCP', 'MODBUS_RTU');

-- CreateEnum
CREATE TYPE "DisplayBoardStatus" AS ENUM ('OK', 'WARN', 'ERROR', 'OFFLINE');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "birthDate" TIMESTAMP(3),
    "provider" TEXT,
    "providerId" TEXT,
    "refreshToken" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT,
    "module" TEXT,
    "action" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "AppMenu" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT,
    "icon" TEXT,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppMenu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppPage" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT,
    "menuId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageAction" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissionKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleMenuPolicy" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT true,
    "scopeType" "ScopeType" NOT NULL DEFAULT 'GLOBAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleMenuPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePagePolicy" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "canView" BOOLEAN NOT NULL DEFAULT true,
    "canCreate" BOOLEAN NOT NULL DEFAULT false,
    "canUpdate" BOOLEAN NOT NULL DEFAULT false,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "canApprove" BOOLEAN NOT NULL DEFAULT false,
    "canExport" BOOLEAN NOT NULL DEFAULT false,
    "scopeType" "ScopeType" NOT NULL DEFAULT 'GLOBAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePagePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserScopeBinding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scopeType" "ScopeType" NOT NULL,
    "parkingLotId" TEXT,
    "parkingSectionId" TEXT,
    "parkingSpaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserScopeBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "vehicleType" TEXT,
    "ownerName" TEXT,
    "memberProfileId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT,
    "vehicleNo" TEXT,
    "membershipNo" TEXT,
    "emergencyContact" TEXT,
    "billingAutoPay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorProfile" (
    "userId" TEXT NOT NULL,
    "phone" TEXT,
    "vehicleNo" TEXT,
    "pinCodeHash" TEXT,
    "note" TEXT,
    "phoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "agreedAt" TIMESTAMP(3),
    "lastAuthenticatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "visitPurpose" TEXT,
    "hostName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitorProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ManagerProfile" (
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "department" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "OperatorProfile" (
    "userId" TEXT NOT NULL,
    "employeeNo" TEXT,
    "companyName" TEXT,
    "shiftType" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatorProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "ParkingLot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "region" TEXT,
    "address" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul',
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "centerLat" DOUBLE PRECISION,
    "centerLng" DOUBLE PRECISION,
    "tenantId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParkingLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkingSection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "parkingLotId" TEXT NOT NULL,
    "centerLat" DOUBLE PRECISION,
    "centerLng" DOUBLE PRECISION,
    "polygonJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParkingSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkingSpace" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "number" TEXT,
    "sectionId" TEXT NOT NULL,
    "type" "SpaceType" NOT NULL DEFAULT 'REGULAR',
    "status" "SpaceStatus" NOT NULL DEFAULT 'EMPTY',
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "widthMeter" DOUBLE PRECISION,
    "heightMeter" DOUBLE PRECISION,
    "rotationDeg" DOUBLE PRECISION,
    "posX" DOUBLE PRECISION,
    "posY" DOUBLE PRECISION,
    "polygonJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParkingSpace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkingSession" (
    "id" TEXT NOT NULL,
    "sessionNo" TEXT NOT NULL,
    "userId" TEXT,
    "vehicleId" TEXT,
    "parkingSpaceId" TEXT,
    "plateNumber" TEXT,
    "sessionType" "SessionType" NOT NULL DEFAULT 'HOURLY',
    "status" "SessionStatus" NOT NULL DEFAULT 'CREATED',
    "entryGate" TEXT,
    "exitGate" TEXT,
    "entryTime" TIMESTAMP(3),
    "exitTime" TIMESTAMP(3),
    "graceStartedAt" TIMESTAMP(3),
    "billingClosedAt" TIMESTAMP(3),
    "totalMinutes" INTEGER,
    "amount" INTEGER,
    "paidAmount" INTEGER,
    "unpaidAmount" INTEGER,
    "feePolicyId" TEXT,
    "isRegistered" BOOLEAN NOT NULL DEFAULT false,
    "registeredAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParkingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkingSessionEvent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParkingSessionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "paidAmount" INTEGER NOT NULL DEFAULT 0,
    "unpaidAmount" INTEGER NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "tossPaymentKey" TEXT,
    "tossOrderId" TEXT,
    "tossTransactionKey" TEXT,
    "approvedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "sessionId" TEXT,
    "issuedByUserId" TEXT,
    "ownerUserId" TEXT,
    "ownerPhone" TEXT,
    "ownerName" TEXT,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'ISSUED',
    "supplyAmount" INTEGER NOT NULL,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntryRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "parkingSpaceId" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExitRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "parkingSpaceId" TEXT,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "exitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExitRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fee" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseAmount" INTEGER NOT NULL,
    "perHour" INTEGER NOT NULL,
    "maxDaily" INTEGER,
    "vehicleType" TEXT NOT NULL,
    "parkingLotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeePolicy" (
    "id" TEXT NOT NULL,
    "parkingLotId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT,
    "vehicleType" TEXT NOT NULL,
    "baseMinutes" INTEGER NOT NULL,
    "baseFee" INTEGER NOT NULL,
    "unitMinutes" INTEGER NOT NULL,
    "unitFee" INTEGER NOT NULL,
    "memberDiscountPercent" INTEGER NOT NULL DEFAULT 0,
    "dailyMax" INTEGER,
    "graceMinutes" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeePolicyTimeRule" (
    "id" TEXT NOT NULL,
    "feePolicyId" TEXT NOT NULL,
    "startHour" INTEGER NOT NULL,
    "endHour" INTEGER NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "FeePolicyTimeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountProgram" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "feeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlySubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parkingLotId" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlySubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" "DiscountType" NOT NULL,
    "value" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "usageLimit" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyCharge" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "parkingLotId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "billingMonth" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "refreshTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "deviceName" TEXT,
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensorDevice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "devEui" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "parkingLotId" TEXT,
    "parkingSectionId" TEXT,
    "parkingSpaceId" TEXT,
    "firmwareVersion" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SensorDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensorEvent" (
    "id" TEXT NOT NULL,
    "sensorDeviceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishStatus" "EventPublishStatus" NOT NULL DEFAULT 'NEW',

    CONSTRAINT "SensorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishStatus" "EventPublishStatus" NOT NULL DEFAULT 'NEW',

    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncOutbox" (
    "id" TEXT NOT NULL,
    "domainEventId" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "ackedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parkingLotId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "vehicleId" TEXT,
    "planName" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outstanding" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "invoiceId" TEXT,
    "sessionId" TEXT,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Outstanding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailySettlement" (
    "id" TEXT NOT NULL,
    "parkingLotId" TEXT NOT NULL,
    "businessDate" TEXT NOT NULL,
    "totalInvoice" INTEGER NOT NULL DEFAULT 0,
    "totalPaid" INTEGER NOT NULL DEFAULT 0,
    "totalRefunded" INTEGER NOT NULL DEFAULT 0,
    "totalOutstanding" INTEGER NOT NULL DEFAULT 0,
    "status" "SettlementStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailySettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserVehicle" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceFault" (
    "id" TEXT NOT NULL,
    "sensorDeviceId" TEXT NOT NULL,
    "devEui" TEXT,
    "name" TEXT,
    "parkingSpaceId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "code" TEXT,
    "severity" "FaultSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "FaultStatus" NOT NULL DEFAULT 'OPEN',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedToUserId" TEXT,
    "actionTaken" TEXT,
    "actionResult" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceFault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "status" "PushNotificationStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "type" "ApprovalRequestType" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requesterId" TEXT NOT NULL,
    "companyName" TEXT,
    "requestedParkingLotName" TEXT,
    "requestedParkingLotId" TEXT,
    "requestedSectionId" TEXT,
    "memo" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parkingLotId" TEXT,
    "parkingSectionId" TEXT,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisplayBoard" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "macAddress" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "parkingLotId" TEXT,
    "parkingSectionId" TEXT,
    "controllerMode" "DisplayControllerMode" NOT NULL DEFAULT 'REST',
    "displayProtocol" "DisplayProtocol" NOT NULL DEFAULT 'TCP',
    "tcpHost" TEXT,
    "tcpPort" INTEGER,
    "modbusHost" TEXT,
    "modbusPort" INTEGER,
    "modbusUnitId" INTEGER,
    "serialPort" TEXT,
    "baudRate" INTEGER,
    "parity" TEXT,
    "stopBits" INTEGER,
    "heartbeatIntervalSec" INTEGER NOT NULL DEFAULT 15,
    "retryMaxAttempts" INTEGER NOT NULL DEFAULT 3,
    "retryBackoffMs" INTEGER NOT NULL DEFAULT 2000,
    "registerProfile" TEXT NOT NULL DEFAULT 'zone_summary_v1',
    "lastHeartbeatAt" TIMESTAMP(3),
    "lastStatus" "DisplayBoardStatus" NOT NULL DEFAULT 'OFFLINE',
    "lastError" TEXT,
    "lastDisplayedState" JSONB,
    "lastIntendedState" JSONB,
    "manualOverrideEnabled" BOOLEAN NOT NULL DEFAULT false,
    "manualOverrideReason" TEXT,
    "manualOverrideState" JSONB,
    "mqttTopic" TEXT,
    "mqttHeartbeatTopic" TEXT,
    "wsPath" TEXT,
    "restPath" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisplayBoard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisplayHeartbeatLog" (
    "id" TEXT NOT NULL,
    "displayBoardId" TEXT NOT NULL,
    "status" "DisplayBoardStatus" NOT NULL,
    "interface" "DisplayProtocol",
    "transportMode" "DisplayControllerMode",
    "lastDisplayedState" JSONB,
    "errorDetails" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisplayHeartbeatLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kosmos_tracker_data" (
    "id" SERIAL NOT NULL,
    "dev_eui" TEXT NOT NULL,
    "gateway_id" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "dr" INTEGER NOT NULL,
    "fcnt" INTEGER NOT NULL,
    "fport" INTEGER NOT NULL,
    "rssi" INTEGER NOT NULL,
    "snr" DOUBLE PRECISION NOT NULL,
    "channel" INTEGER NOT NULL,
    "battery_status" INTEGER NOT NULL,
    "device_status" INTEGER NOT NULL,
    "latitude_deg" DOUBLE PRECISION NOT NULL,
    "longitude_deg" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "battery_voltage" DOUBLE PRECISION,
    "sensor_info" INTEGER,
    "firmware_version" INTEGER,

    CONSTRAINT "kosmos_tracker_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parking_sensor_data" (
    "id" SERIAL NOT NULL,
    "dev_eui" TEXT NOT NULL,
    "gateway_id" TEXT NOT NULL,
    "time" TIMESTAMP(3) NOT NULL,
    "dr" INTEGER NOT NULL,
    "fcnt" INTEGER NOT NULL,
    "fport" INTEGER NOT NULL,
    "rssi" INTEGER NOT NULL,
    "snr" DOUBLE PRECISION NOT NULL,
    "channel" INTEGER NOT NULL,
    "battery_status" INTEGER NOT NULL,
    "device_status" INTEGER NOT NULL,
    "parking_status" INTEGER NOT NULL,
    "firmware_version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "battery_voltage" DOUBLE PRECISION,

    CONSTRAINT "parking_sensor_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parking_state" (
    "dev_eui" TEXT NOT NULL,
    "parking_status" INTEGER NOT NULL,
    "state_since" TIMESTAMP(3) NOT NULL,
    "last_message_time" TIMESTAMP(3) NOT NULL,
    "rssi" INTEGER,
    "snr" DOUBLE PRECISION,
    "battery_voltage" DOUBLE PRECISION,

    CONSTRAINT "parking_state_pkey" PRIMARY KEY ("dev_eui")
);

-- CreateTable
CREATE TABLE "sensio_env_data" (
    "id" SERIAL NOT NULL,
    "dev_eui" TEXT,
    "gateway_id" TEXT,
    "time" TIMESTAMP(3) NOT NULL,
    "dr" INTEGER NOT NULL,
    "fcnt" INTEGER NOT NULL,
    "fport" INTEGER NOT NULL,
    "rssi" INTEGER NOT NULL,
    "snr" DOUBLE PRECISION NOT NULL,
    "channel" INTEGER NOT NULL,
    "temperature_c" DOUBLE PRECISION NOT NULL,
    "humidity_percent" INTEGER NOT NULL,
    "pm1_0_ug_m3" DOUBLE PRECISION NOT NULL,
    "pm2_5_ug_m3" DOUBLE PRECISION NOT NULL,
    "pm10_ug_m3" DOUBLE PRECISION NOT NULL,
    "battery_state" INTEGER NOT NULL,
    "comm_env_ok" BOOLEAN NOT NULL,
    "device_ok" BOOLEAN NOT NULL,
    "sensor_ok" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensio_env_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slot_mapping" (
    "slot_id" INTEGER NOT NULL,
    "slot_label" TEXT NOT NULL,
    "dev_eui" TEXT NOT NULL,

    CONSTRAINT "slot_mapping_pkey" PRIMARY KEY ("slot_id")
);

-- CreateTable
CREATE TABLE "UserBlacklist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBlacklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "Role_createdAt_idx" ON "Role"("createdAt");

-- CreateIndex
CREATE INDEX "UserRole_roleId_idx" ON "UserRole"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "Permission_module_idx" ON "Permission"("module");

-- CreateIndex
CREATE INDEX "Permission_action_idx" ON "Permission"("action");

-- CreateIndex
CREATE INDEX "Permission_createdAt_idx" ON "Permission"("createdAt");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "AppMenu_code_key" ON "AppMenu"("code");

-- CreateIndex
CREATE INDEX "AppMenu_parentId_idx" ON "AppMenu"("parentId");

-- CreateIndex
CREATE INDEX "AppMenu_sortOrder_idx" ON "AppMenu"("sortOrder");

-- CreateIndex
CREATE INDEX "AppMenu_isVisible_idx" ON "AppMenu"("isVisible");

-- CreateIndex
CREATE UNIQUE INDEX "AppPage_code_key" ON "AppPage"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AppPage_route_key" ON "AppPage"("route");

-- CreateIndex
CREATE INDEX "AppPage_menuId_idx" ON "AppPage"("menuId");

-- CreateIndex
CREATE INDEX "AppPage_module_idx" ON "AppPage"("module");

-- CreateIndex
CREATE INDEX "AppPage_sortOrder_idx" ON "AppPage"("sortOrder");

-- CreateIndex
CREATE INDEX "AppPage_isVisible_idx" ON "AppPage"("isVisible");

-- CreateIndex
CREATE INDEX "PageAction_permissionKey_idx" ON "PageAction"("permissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "PageAction_pageId_code_key" ON "PageAction"("pageId", "code");

-- CreateIndex
CREATE INDEX "RoleMenuPolicy_roleId_idx" ON "RoleMenuPolicy"("roleId");

-- CreateIndex
CREATE INDEX "RoleMenuPolicy_menuId_idx" ON "RoleMenuPolicy"("menuId");

-- CreateIndex
CREATE INDEX "RoleMenuPolicy_scopeType_idx" ON "RoleMenuPolicy"("scopeType");

-- CreateIndex
CREATE UNIQUE INDEX "RoleMenuPolicy_roleId_menuId_key" ON "RoleMenuPolicy"("roleId", "menuId");

-- CreateIndex
CREATE INDEX "RolePagePolicy_roleId_idx" ON "RolePagePolicy"("roleId");

-- CreateIndex
CREATE INDEX "RolePagePolicy_pageId_idx" ON "RolePagePolicy"("pageId");

-- CreateIndex
CREATE INDEX "RolePagePolicy_scopeType_idx" ON "RolePagePolicy"("scopeType");

-- CreateIndex
CREATE UNIQUE INDEX "RolePagePolicy_roleId_pageId_key" ON "RolePagePolicy"("roleId", "pageId");

-- CreateIndex
CREATE INDEX "UserScopeBinding_userId_idx" ON "UserScopeBinding"("userId");

-- CreateIndex
CREATE INDEX "UserScopeBinding_userId_scopeType_idx" ON "UserScopeBinding"("userId", "scopeType");

-- CreateIndex
CREATE INDEX "UserScopeBinding_parkingLotId_idx" ON "UserScopeBinding"("parkingLotId");

-- CreateIndex
CREATE INDEX "UserScopeBinding_parkingSectionId_idx" ON "UserScopeBinding"("parkingSectionId");

-- CreateIndex
CREATE INDEX "UserScopeBinding_parkingSpaceId_idx" ON "UserScopeBinding"("parkingSpaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_plateNumber_key" ON "Vehicle"("plateNumber");

-- CreateIndex
CREATE INDEX "Vehicle_plateNumber_idx" ON "Vehicle"("plateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MemberProfile_userId_key" ON "MemberProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ParkingLot_code_key" ON "ParkingLot"("code");

-- CreateIndex
CREATE INDEX "ParkingLot_name_idx" ON "ParkingLot"("name");

-- CreateIndex
CREATE INDEX "ParkingLot_region_idx" ON "ParkingLot"("region");

-- CreateIndex
CREATE INDEX "ParkingLot_isActive_idx" ON "ParkingLot"("isActive");

-- CreateIndex
CREATE INDEX "ParkingLot_createdAt_idx" ON "ParkingLot"("createdAt");

-- CreateIndex
CREATE INDEX "ParkingSection_parkingLotId_idx" ON "ParkingSection"("parkingLotId");

-- CreateIndex
CREATE INDEX "ParkingSection_name_idx" ON "ParkingSection"("name");

-- CreateIndex
CREATE INDEX "ParkingSection_isActive_idx" ON "ParkingSection"("isActive");

-- CreateIndex
CREATE INDEX "ParkingSection_createdAt_idx" ON "ParkingSection"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ParkingSection_parkingLotId_code_key" ON "ParkingSection"("parkingLotId", "code");

-- CreateIndex
CREATE INDEX "ParkingSpace_sectionId_idx" ON "ParkingSpace"("sectionId");

-- CreateIndex
CREATE INDEX "ParkingSpace_status_idx" ON "ParkingSpace"("status");

-- CreateIndex
CREATE INDEX "ParkingSpace_isActive_idx" ON "ParkingSpace"("isActive");

-- CreateIndex
CREATE INDEX "ParkingSpace_createdAt_idx" ON "ParkingSpace"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ParkingSpace_sectionId_code_key" ON "ParkingSpace"("sectionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ParkingSession_sessionNo_key" ON "ParkingSession"("sessionNo");

-- CreateIndex
CREATE INDEX "ParkingSession_userId_idx" ON "ParkingSession"("userId");

-- CreateIndex
CREATE INDEX "ParkingSession_vehicleId_idx" ON "ParkingSession"("vehicleId");

-- CreateIndex
CREATE INDEX "ParkingSession_parkingSpaceId_idx" ON "ParkingSession"("parkingSpaceId");

-- CreateIndex
CREATE INDEX "ParkingSession_status_idx" ON "ParkingSession"("status");

-- CreateIndex
CREATE INDEX "ParkingSession_entryTime_idx" ON "ParkingSession"("entryTime");

-- CreateIndex
CREATE INDEX "ParkingSession_registeredAt_idx" ON "ParkingSession"("registeredAt");

-- CreateIndex
CREATE INDEX "ParkingSession_createdAt_idx" ON "ParkingSession"("createdAt");

-- CreateIndex
CREATE INDEX "ParkingSessionEvent_sessionId_createdAt_idx" ON "ParkingSessionEvent"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "ParkingSessionEvent_type_idx" ON "ParkingSessionEvent"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNo_key" ON "Invoice"("invoiceNo");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_sessionId_key" ON "Invoice"("sessionId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_tossPaymentKey_key" ON "Payment"("tossPaymentKey");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_tossOrderId_key" ON "Payment"("tossOrderId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_receiptNo_key" ON "Receipt"("receiptNo");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_paymentId_key" ON "Receipt"("paymentId");

-- CreateIndex
CREATE INDEX "Receipt_paymentId_idx" ON "Receipt"("paymentId");

-- CreateIndex
CREATE INDEX "Receipt_invoiceId_idx" ON "Receipt"("invoiceId");

-- CreateIndex
CREATE INDEX "Receipt_sessionId_idx" ON "Receipt"("sessionId");

-- CreateIndex
CREATE INDEX "Receipt_ownerUserId_idx" ON "Receipt"("ownerUserId");

-- CreateIndex
CREATE INDEX "Receipt_issuedAt_idx" ON "Receipt"("issuedAt");

-- CreateIndex
CREATE INDEX "EntryRecord_userId_idx" ON "EntryRecord"("userId");

-- CreateIndex
CREATE INDEX "EntryRecord_vehicleId_idx" ON "EntryRecord"("vehicleId");

-- CreateIndex
CREATE INDEX "EntryRecord_parkingSpaceId_idx" ON "EntryRecord"("parkingSpaceId");

-- CreateIndex
CREATE INDEX "EntryRecord_enteredAt_idx" ON "EntryRecord"("enteredAt");

-- CreateIndex
CREATE INDEX "ExitRecord_userId_idx" ON "ExitRecord"("userId");

-- CreateIndex
CREATE INDEX "ExitRecord_vehicleId_idx" ON "ExitRecord"("vehicleId");

-- CreateIndex
CREATE INDEX "ExitRecord_parkingSpaceId_idx" ON "ExitRecord"("parkingSpaceId");

-- CreateIndex
CREATE INDEX "ExitRecord_exitedAt_idx" ON "ExitRecord"("exitedAt");

-- CreateIndex
CREATE INDEX "Fee_parkingLotId_idx" ON "Fee"("parkingLotId");

-- CreateIndex
CREATE INDEX "Fee_vehicleType_idx" ON "Fee"("vehicleType");

-- CreateIndex
CREATE INDEX "Fee_createdAt_idx" ON "Fee"("createdAt");

-- CreateIndex
CREATE INDEX "FeePolicy_parkingLotId_idx" ON "FeePolicy"("parkingLotId");

-- CreateIndex
CREATE INDEX "FeePolicy_vehicleType_idx" ON "FeePolicy"("vehicleType");

-- CreateIndex
CREATE INDEX "FeePolicy_isActive_idx" ON "FeePolicy"("isActive");

-- CreateIndex
CREATE INDEX "FeePolicy_createdAt_idx" ON "FeePolicy"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeePolicy_parkingLotId_code_key" ON "FeePolicy"("parkingLotId", "code");

-- CreateIndex
CREATE INDEX "DiscountProgram_feeId_idx" ON "DiscountProgram"("feeId");

-- CreateIndex
CREATE INDEX "DiscountProgram_isActive_idx" ON "DiscountProgram"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE INDEX "Coupon_expiresAt_idx" ON "Coupon"("expiresAt");

-- CreateIndex
CREATE INDEX "Coupon_isActive_idx" ON "Coupon"("isActive");

-- CreateIndex
CREATE INDEX "Coupon_createdAt_idx" ON "Coupon"("createdAt");

-- CreateIndex
CREATE INDEX "MonthlyCharge_userId_idx" ON "MonthlyCharge"("userId");

-- CreateIndex
CREATE INDEX "MonthlyCharge_parkingLotId_idx" ON "MonthlyCharge"("parkingLotId");

-- CreateIndex
CREATE INDEX "MonthlyCharge_status_idx" ON "MonthlyCharge"("status");

-- CreateIndex
CREATE INDEX "MonthlyCharge_createdAt_idx" ON "MonthlyCharge"("createdAt");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_deviceId_idx" ON "Session"("deviceId");

-- CreateIndex
CREATE INDEX "Session_createdAt_idx" ON "Session"("createdAt");

-- CreateIndex
CREATE INDEX "UserDevice_userId_idx" ON "UserDevice"("userId");

-- CreateIndex
CREATE INDEX "UserDevice_createdAt_idx" ON "UserDevice"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SensorDevice_serialNumber_key" ON "SensorDevice"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SensorDevice_devEui_key" ON "SensorDevice"("devEui");

-- CreateIndex
CREATE UNIQUE INDEX "SensorDevice_parkingSpaceId_key" ON "SensorDevice"("parkingSpaceId");

-- CreateIndex
CREATE INDEX "SensorDevice_parkingLotId_idx" ON "SensorDevice"("parkingLotId");

-- CreateIndex
CREATE INDEX "SensorDevice_parkingSectionId_idx" ON "SensorDevice"("parkingSectionId");

-- CreateIndex
CREATE INDEX "SensorDevice_status_idx" ON "SensorDevice"("status");

-- CreateIndex
CREATE INDEX "SensorDevice_lastSeenAt_idx" ON "SensorDevice"("lastSeenAt");

-- CreateIndex
CREATE INDEX "SensorDevice_createdAt_idx" ON "SensorDevice"("createdAt");

-- CreateIndex
CREATE INDEX "SensorEvent_sensorDeviceId_receivedAt_idx" ON "SensorEvent"("sensorDeviceId", "receivedAt");

-- CreateIndex
CREATE INDEX "SensorEvent_publishStatus_idx" ON "SensorEvent"("publishStatus");

-- CreateIndex
CREATE INDEX "SensorEvent_eventType_idx" ON "SensorEvent"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "DomainEvent_eventId_key" ON "DomainEvent"("eventId");

-- CreateIndex
CREATE INDEX "DomainEvent_aggregateType_aggregateId_idx" ON "DomainEvent"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "DomainEvent_publishStatus_idx" ON "DomainEvent"("publishStatus");

-- CreateIndex
CREATE INDEX "DomainEvent_occurredAt_idx" ON "DomainEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "DomainEvent_createdAt_idx" ON "DomainEvent"("createdAt");

-- CreateIndex
CREATE INDEX "SyncOutbox_status_nextRetryAt_idx" ON "SyncOutbox"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "SyncOutbox_destination_idx" ON "SyncOutbox"("destination");

-- CreateIndex
CREATE INDEX "SyncOutbox_createdAt_idx" ON "SyncOutbox"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_parkingLotId_idx" ON "Subscription"("parkingLotId");

-- CreateIndex
CREATE INDEX "Subscription_vehicleId_idx" ON "Subscription"("vehicleId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_startDate_endDate_idx" ON "Subscription"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Outstanding_invoiceId_key" ON "Outstanding"("invoiceId");

-- CreateIndex
CREATE INDEX "Outstanding_userId_idx" ON "Outstanding"("userId");

-- CreateIndex
CREATE INDEX "Outstanding_sessionId_idx" ON "Outstanding"("sessionId");

-- CreateIndex
CREATE INDEX "Outstanding_status_idx" ON "Outstanding"("status");

-- CreateIndex
CREATE INDEX "Outstanding_dueAt_idx" ON "Outstanding"("dueAt");

-- CreateIndex
CREATE INDEX "DailySettlement_businessDate_idx" ON "DailySettlement"("businessDate");

-- CreateIndex
CREATE INDEX "DailySettlement_status_idx" ON "DailySettlement"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DailySettlement_parkingLotId_businessDate_key" ON "DailySettlement"("parkingLotId", "businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "UserVehicle_userId_vehicleId_key" ON "UserVehicle"("userId", "vehicleId");

-- CreateIndex
CREATE INDEX "DeviceFault_sensorDeviceId_idx" ON "DeviceFault"("sensorDeviceId");

-- CreateIndex
CREATE INDEX "DeviceFault_status_idx" ON "DeviceFault"("status");

-- CreateIndex
CREATE INDEX "DeviceFault_severity_idx" ON "DeviceFault"("severity");

-- CreateIndex
CREATE INDEX "DeviceFault_assignedToUserId_idx" ON "DeviceFault"("assignedToUserId");

-- CreateIndex
CREATE INDEX "DeviceFault_detectedAt_idx" ON "DeviceFault"("detectedAt");

-- CreateIndex
CREATE INDEX "PushNotification_userId_idx" ON "PushNotification"("userId");

-- CreateIndex
CREATE INDEX "PushNotification_status_idx" ON "PushNotification"("status");

-- CreateIndex
CREATE INDEX "PushNotification_createdAt_idx" ON "PushNotification"("createdAt");

-- CreateIndex
CREATE INDEX "ApprovalRequest_type_status_idx" ON "ApprovalRequest"("type", "status");

-- CreateIndex
CREATE INDEX "ApprovalRequest_requesterId_idx" ON "ApprovalRequest"("requesterId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_reviewedById_idx" ON "ApprovalRequest"("reviewedById");

-- CreateIndex
CREATE INDEX "ApprovalRequest_requesterId_status_idx" ON "ApprovalRequest"("requesterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");

-- CreateIndex
CREATE INDEX "PushToken_userId_idx" ON "PushToken"("userId");

-- CreateIndex
CREATE INDEX "PushToken_isActive_idx" ON "PushToken"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DisplayBoard_deviceId_key" ON "DisplayBoard"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "DisplayBoard_macAddress_key" ON "DisplayBoard"("macAddress");

-- CreateIndex
CREATE UNIQUE INDEX "DisplayBoard_code_key" ON "DisplayBoard"("code");

-- CreateIndex
CREATE INDEX "DisplayBoard_parkingLotId_idx" ON "DisplayBoard"("parkingLotId");

-- CreateIndex
CREATE INDEX "DisplayBoard_parkingSectionId_idx" ON "DisplayBoard"("parkingSectionId");

-- CreateIndex
CREATE INDEX "DisplayBoard_lastStatus_idx" ON "DisplayBoard"("lastStatus");

-- CreateIndex
CREATE INDEX "DisplayHeartbeatLog_displayBoardId_receivedAt_idx" ON "DisplayHeartbeatLog"("displayBoardId", "receivedAt");

-- CreateIndex
CREATE INDEX "parking_sensor_data_dev_eui_idx" ON "parking_sensor_data"("dev_eui");

-- CreateIndex
CREATE INDEX "parking_sensor_data_time_idx" ON "parking_sensor_data"("time");

-- CreateIndex
CREATE UNIQUE INDEX "slot_mapping_dev_eui_key" ON "slot_mapping"("dev_eui");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppMenu" ADD CONSTRAINT "AppMenu_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AppMenu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppPage" ADD CONSTRAINT "AppPage_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "AppMenu"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageAction" ADD CONSTRAINT "PageAction_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "AppPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleMenuPolicy" ADD CONSTRAINT "RoleMenuPolicy_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleMenuPolicy" ADD CONSTRAINT "RoleMenuPolicy_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "AppMenu"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePagePolicy" ADD CONSTRAINT "RolePagePolicy_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePagePolicy" ADD CONSTRAINT "RolePagePolicy_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "AppPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserScopeBinding" ADD CONSTRAINT "UserScopeBinding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserScopeBinding" ADD CONSTRAINT "UserScopeBinding_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserScopeBinding" ADD CONSTRAINT "UserScopeBinding_parkingSectionId_fkey" FOREIGN KEY ("parkingSectionId") REFERENCES "ParkingSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserScopeBinding" ADD CONSTRAINT "UserScopeBinding_parkingSpaceId_fkey" FOREIGN KEY ("parkingSpaceId") REFERENCES "ParkingSpace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_memberProfileId_fkey" FOREIGN KEY ("memberProfileId") REFERENCES "MemberProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberProfile" ADD CONSTRAINT "MemberProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorProfile" ADD CONSTRAINT "VisitorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerProfile" ADD CONSTRAINT "ManagerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerProfile" ADD CONSTRAINT "ManagerProfile_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorProfile" ADD CONSTRAINT "OperatorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorProfile" ADD CONSTRAINT "OperatorProfile_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingLot" ADD CONSTRAINT "ParkingLot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingSection" ADD CONSTRAINT "ParkingSection_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingSpace" ADD CONSTRAINT "ParkingSpace_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ParkingSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingSession" ADD CONSTRAINT "ParkingSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingSession" ADD CONSTRAINT "ParkingSession_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingSession" ADD CONSTRAINT "ParkingSession_parkingSpaceId_fkey" FOREIGN KEY ("parkingSpaceId") REFERENCES "ParkingSpace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingSession" ADD CONSTRAINT "ParkingSession_feePolicyId_fkey" FOREIGN KEY ("feePolicyId") REFERENCES "FeePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingSessionEvent" ADD CONSTRAINT "ParkingSessionEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ParkingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ParkingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ParkingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_issuedByUserId_fkey" FOREIGN KEY ("issuedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryRecord" ADD CONSTRAINT "EntryRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryRecord" ADD CONSTRAINT "EntryRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryRecord" ADD CONSTRAINT "EntryRecord_parkingSpaceId_fkey" FOREIGN KEY ("parkingSpaceId") REFERENCES "ParkingSpace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExitRecord" ADD CONSTRAINT "ExitRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExitRecord" ADD CONSTRAINT "ExitRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExitRecord" ADD CONSTRAINT "ExitRecord_parkingSpaceId_fkey" FOREIGN KEY ("parkingSpaceId") REFERENCES "ParkingSpace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fee" ADD CONSTRAINT "Fee_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePolicy" ADD CONSTRAINT "FeePolicy_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeePolicyTimeRule" ADD CONSTRAINT "FeePolicyTimeRule_feePolicyId_fkey" FOREIGN KEY ("feePolicyId") REFERENCES "FeePolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountProgram" ADD CONSTRAINT "DiscountProgram_feeId_fkey" FOREIGN KEY ("feeId") REFERENCES "Fee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlySubscription" ADD CONSTRAINT "MonthlySubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlySubscription" ADD CONSTRAINT "MonthlySubscription_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDevice" ADD CONSTRAINT "UserDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorDevice" ADD CONSTRAINT "SensorDevice_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorDevice" ADD CONSTRAINT "SensorDevice_parkingSectionId_fkey" FOREIGN KEY ("parkingSectionId") REFERENCES "ParkingSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorDevice" ADD CONSTRAINT "SensorDevice_parkingSpaceId_fkey" FOREIGN KEY ("parkingSpaceId") REFERENCES "ParkingSpace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorEvent" ADD CONSTRAINT "SensorEvent_sensorDeviceId_fkey" FOREIGN KEY ("sensorDeviceId") REFERENCES "SensorDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncOutbox" ADD CONSTRAINT "SyncOutbox_domainEventId_fkey" FOREIGN KEY ("domainEventId") REFERENCES "DomainEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outstanding" ADD CONSTRAINT "Outstanding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySettlement" ADD CONSTRAINT "DailySettlement_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVehicle" ADD CONSTRAINT "UserVehicle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVehicle" ADD CONSTRAINT "UserVehicle_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceFault" ADD CONSTRAINT "DeviceFault_parkingSpaceId_fkey" FOREIGN KEY ("parkingSpaceId") REFERENCES "ParkingSpace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceFault" ADD CONSTRAINT "DeviceFault_sensorDeviceId_fkey" FOREIGN KEY ("sensorDeviceId") REFERENCES "SensorDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceFault" ADD CONSTRAINT "DeviceFault_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushNotification" ADD CONSTRAINT "PushNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_parkingSectionId_fkey" FOREIGN KEY ("parkingSectionId") REFERENCES "ParkingSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushToken" ADD CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisplayBoard" ADD CONSTRAINT "DisplayBoard_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisplayBoard" ADD CONSTRAINT "DisplayBoard_parkingSectionId_fkey" FOREIGN KEY ("parkingSectionId") REFERENCES "ParkingSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisplayHeartbeatLog" ADD CONSTRAINT "DisplayHeartbeatLog_displayBoardId_fkey" FOREIGN KEY ("displayBoardId") REFERENCES "DisplayBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
