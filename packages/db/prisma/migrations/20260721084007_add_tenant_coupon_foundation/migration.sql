BEGIN;

CREATE TYPE "TenantCouponPurchaseStatus" AS ENUM (
  'REQUESTED',
  'PAYMENT_PENDING',
  'PAYMENT_CONFIRMED',
  'ISSUED',
  'CANCELLED'
);

CREATE TYPE "TenantCouponStatus" AS ENUM (
  'AVAILABLE',
  'ASSIGNED',
  'RESERVED',
  'USED',
  'EXPIRED',
  'CANCELLED'
);

CREATE TYPE "TenantCouponEventType" AS ENUM (
  'ISSUED',
  'ASSIGNED',
  'RESERVED',
  'RESERVATION_RELEASED',
  'USED',
  'CANCELLED',
  'EXPIRED'
);

CREATE TABLE "TenantCouponProduct" (
  "id" TEXT NOT NULL,
  "parkingLotId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "benefitType" "DiscountBenefitType" NOT NULL,
  "benefitValue" INTEGER NOT NULL,
  "salePrice" INTEGER NOT NULL,
  "validityMonths" INTEGER NOT NULL DEFAULT 1,
  "stackableWithAutomaticDiscount" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantCouponProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantCouponPurchase" (
  "id" TEXT NOT NULL,
  "purchaseNo" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" INTEGER NOT NULL,
  "totalAmount" INTEGER NOT NULL,
  "paidAmount" INTEGER NOT NULL DEFAULT 0,
  "status" "TenantCouponPurchaseStatus" NOT NULL DEFAULT 'PAYMENT_PENDING',
  "paymentReference" TEXT,
  "memo" TEXT,
  "requestedByUserId" TEXT,
  "paymentConfirmedByUserId" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paymentConfirmedAt" TIMESTAMP(3),
  "issuedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantCouponPurchase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantCoupon" (
  "id" TEXT NOT NULL,
  "serialNo" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "codeMasked" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "purchaseId" TEXT NOT NULL,
  "status" "TenantCouponStatus" NOT NULL DEFAULT 'AVAILABLE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "assignedMemberUserId" TEXT,
  "assignedByUserId" TEXT,
  "assignedAt" TIMESTAMP(3),
  "reservedSessionId" TEXT,
  "reservationToken" TEXT,
  "reservationExpiresAt" TIMESTAMP(3),
  "usedSessionId" TEXT,
  "usedInvoiceId" TEXT,
  "usedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantCoupon_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TenantCouponEvent" (
  "id" TEXT NOT NULL,
  "couponId" TEXT NOT NULL,
  "eventType" "TenantCouponEventType" NOT NULL,
  "fromStatus" "TenantCouponStatus",
  "toStatus" "TenantCouponStatus",
  "actorUserId" TEXT,
  "memberUserId" TEXT,
  "parkingSessionId" TEXT,
  "invoiceId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantCouponEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantCouponProduct_parkingLotId_code_key"
  ON "TenantCouponProduct"("parkingLotId", "code");
CREATE INDEX "TenantCouponProduct_parkingLotId_isActive_idx"
  ON "TenantCouponProduct"("parkingLotId", "isActive");
CREATE INDEX "TenantCouponProduct_createdAt_idx"
  ON "TenantCouponProduct"("createdAt");

CREATE UNIQUE INDEX "TenantCouponPurchase_purchaseNo_key"
  ON "TenantCouponPurchase"("purchaseNo");
CREATE INDEX "TenantCouponPurchase_tenantId_status_idx"
  ON "TenantCouponPurchase"("tenantId", "status");
CREATE INDEX "TenantCouponPurchase_productId_idx"
  ON "TenantCouponPurchase"("productId");
CREATE INDEX "TenantCouponPurchase_requestedAt_idx"
  ON "TenantCouponPurchase"("requestedAt");
CREATE INDEX "TenantCouponPurchase_paymentConfirmedAt_idx"
  ON "TenantCouponPurchase"("paymentConfirmedAt");

CREATE UNIQUE INDEX "TenantCoupon_serialNo_key"
  ON "TenantCoupon"("serialNo");
CREATE UNIQUE INDEX "TenantCoupon_codeHash_key"
  ON "TenantCoupon"("codeHash");
CREATE UNIQUE INDEX "TenantCoupon_reservationToken_key"
  ON "TenantCoupon"("reservationToken");
CREATE INDEX "TenantCoupon_tenantId_status_idx"
  ON "TenantCoupon"("tenantId", "status");
CREATE INDEX "TenantCoupon_productId_status_idx"
  ON "TenantCoupon"("productId", "status");
CREATE INDEX "TenantCoupon_purchaseId_idx"
  ON "TenantCoupon"("purchaseId");
CREATE INDEX "TenantCoupon_assignedMemberUserId_status_idx"
  ON "TenantCoupon"("assignedMemberUserId", "status");
CREATE INDEX "TenantCoupon_expiresAt_idx"
  ON "TenantCoupon"("expiresAt");
CREATE INDEX "TenantCoupon_reservedSessionId_idx"
  ON "TenantCoupon"("reservedSessionId");
CREATE INDEX "TenantCoupon_usedSessionId_idx"
  ON "TenantCoupon"("usedSessionId");
CREATE INDEX "TenantCoupon_usedInvoiceId_idx"
  ON "TenantCoupon"("usedInvoiceId");

CREATE INDEX "TenantCouponEvent_couponId_createdAt_idx"
  ON "TenantCouponEvent"("couponId", "createdAt");
CREATE INDEX "TenantCouponEvent_eventType_idx"
  ON "TenantCouponEvent"("eventType");
CREATE INDEX "TenantCouponEvent_actorUserId_idx"
  ON "TenantCouponEvent"("actorUserId");
CREATE INDEX "TenantCouponEvent_memberUserId_idx"
  ON "TenantCouponEvent"("memberUserId");
CREATE INDEX "TenantCouponEvent_parkingSessionId_idx"
  ON "TenantCouponEvent"("parkingSessionId");
CREATE INDEX "TenantCouponEvent_invoiceId_idx"
  ON "TenantCouponEvent"("invoiceId");

ALTER TABLE "TenantCouponProduct"
  ADD CONSTRAINT "TenantCouponProduct_parkingLotId_fkey"
  FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TenantCouponPurchase"
  ADD CONSTRAINT "TenantCouponPurchase_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantCouponPurchase"
  ADD CONSTRAINT "TenantCouponPurchase_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "TenantCouponProduct"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantCouponPurchase"
  ADD CONSTRAINT "TenantCouponPurchase_requestedByUserId_fkey"
  FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TenantCouponPurchase"
  ADD CONSTRAINT "TenantCouponPurchase_paymentConfirmedByUserId_fkey"
  FOREIGN KEY ("paymentConfirmedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TenantCoupon"
  ADD CONSTRAINT "TenantCoupon_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantCoupon"
  ADD CONSTRAINT "TenantCoupon_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "TenantCouponProduct"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantCoupon"
  ADD CONSTRAINT "TenantCoupon_purchaseId_fkey"
  FOREIGN KEY ("purchaseId") REFERENCES "TenantCouponPurchase"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TenantCoupon"
  ADD CONSTRAINT "TenantCoupon_assignedMemberUserId_fkey"
  FOREIGN KEY ("assignedMemberUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TenantCoupon"
  ADD CONSTRAINT "TenantCoupon_assignedByUserId_fkey"
  FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TenantCoupon"
  ADD CONSTRAINT "TenantCoupon_reservedSessionId_fkey"
  FOREIGN KEY ("reservedSessionId") REFERENCES "ParkingSession"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TenantCoupon"
  ADD CONSTRAINT "TenantCoupon_usedSessionId_fkey"
  FOREIGN KEY ("usedSessionId") REFERENCES "ParkingSession"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TenantCoupon"
  ADD CONSTRAINT "TenantCoupon_usedInvoiceId_fkey"
  FOREIGN KEY ("usedInvoiceId") REFERENCES "Invoice"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TenantCouponEvent"
  ADD CONSTRAINT "TenantCouponEvent_couponId_fkey"
  FOREIGN KEY ("couponId") REFERENCES "TenantCoupon"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TenantCouponEvent"
  ADD CONSTRAINT "TenantCouponEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TenantCouponEvent"
  ADD CONSTRAINT "TenantCouponEvent_memberUserId_fkey"
  FOREIGN KEY ("memberUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TenantCouponEvent"
  ADD CONSTRAINT "TenantCouponEvent_parkingSessionId_fkey"
  FOREIGN KEY ("parkingSessionId") REFERENCES "ParkingSession"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TenantCouponEvent"
  ADD CONSTRAINT "TenantCouponEvent_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
