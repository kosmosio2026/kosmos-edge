-- Reconcile required runtime schema that existed as operational schema drift
-- but was missing from the reproducible Prisma migration history.
--
-- This migration is intentionally additive.
-- Legacy extra columns and indexes are preserved and are not dropped.

-- ---------------------------------------------------------------------------
-- SpaceType
-- ---------------------------------------------------------------------------

ALTER TYPE "SpaceType"
ADD VALUE IF NOT EXISTS 'PREGNANT';

-- ---------------------------------------------------------------------------
-- ApprovalRequest
-- ---------------------------------------------------------------------------

ALTER TABLE "ApprovalRequest"
ADD COLUMN IF NOT EXISTS "requestData" JSONB;

-- ---------------------------------------------------------------------------
-- DailySettlement
-- ---------------------------------------------------------------------------

ALTER TABLE "DailySettlement"
ADD COLUMN IF NOT EXISTS "closedByUserId" TEXT;

CREATE INDEX IF NOT EXISTS "DailySettlement_closedByUserId_idx"
ON "DailySettlement"("closedByUserId");

-- ---------------------------------------------------------------------------
-- OperatorProfile
-- ---------------------------------------------------------------------------

ALTER TABLE "OperatorProfile"
ADD COLUMN IF NOT EXISTS "emergencyContact" TEXT;

-- ---------------------------------------------------------------------------
-- ParkingSession
-- ---------------------------------------------------------------------------

ALTER TABLE "ParkingSession"
ADD COLUMN IF NOT EXISTS "entrySource" TEXT;

ALTER TABLE "ParkingSession"
ADD COLUMN IF NOT EXISTS "exitSource" TEXT;

ALTER TABLE "ParkingSession"
ADD COLUMN IF NOT EXISTS "manualEntryAt" TIMESTAMP(3);

ALTER TABLE "ParkingSession"
ADD COLUMN IF NOT EXISTS "manualEntryByUserId" TEXT;

ALTER TABLE "ParkingSession"
ADD COLUMN IF NOT EXISTS "manualExitAt" TIMESTAMP(3);

ALTER TABLE "ParkingSession"
ADD COLUMN IF NOT EXISTS "manualExitByUserId" TEXT;

ALTER TABLE "ParkingSession"
ADD COLUMN IF NOT EXISTS "tenantConfirmedAt" TIMESTAMP(3);

ALTER TABLE "ParkingSession"
ADD COLUMN IF NOT EXISTS "tenantGraceUntil" TIMESTAMP(3);

ALTER TABLE "ParkingSession"
ADD COLUMN IF NOT EXISTS "tenantVisitConfirmedBy" TEXT;

ALTER TABLE "ParkingSession"
ADD COLUMN IF NOT EXISTS "visitTenantId" TEXT;

UPDATE "ParkingSession"
SET "entrySource" = 'SENSOR'
WHERE "entrySource" IS NULL;

ALTER TABLE "ParkingSession"
ALTER COLUMN "entrySource" SET DEFAULT 'SENSOR';

ALTER TABLE "ParkingSession"
ALTER COLUMN "entrySource" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "ParkingSession_entrySource_idx"
ON "ParkingSession"("entrySource");

CREATE INDEX IF NOT EXISTS "ParkingSession_exitSource_idx"
ON "ParkingSession"("exitSource");

CREATE INDEX IF NOT EXISTS "ParkingSession_visitTenantId_idx"
ON "ParkingSession"("visitTenantId");

CREATE INDEX IF NOT EXISTS "ParkingSession_tenantConfirmedAt_idx"
ON "ParkingSession"("tenantConfirmedAt");

CREATE INDEX IF NOT EXISTS "ParkingSession_tenantGraceUntil_idx"
ON "ParkingSession"("tenantGraceUntil");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ParkingSession_visitTenantId_fkey'
      AND conrelid = '"ParkingSession"'::regclass
  ) THEN
    ALTER TABLE "ParkingSession"
    ADD CONSTRAINT "ParkingSession_visitTenantId_fkey"
    FOREIGN KEY ("visitTenantId")
    REFERENCES "Tenant"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'ParkingSession_tenantVisitConfirmedBy_fkey'
      AND conrelid = '"ParkingSession"'::regclass
  ) THEN
    ALTER TABLE "ParkingSession"
    ADD CONSTRAINT
      "ParkingSession_tenantVisitConfirmedBy_fkey"
    FOREIGN KEY ("tenantVisitConfirmedBy")
    REFERENCES "User"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- TenantUser
-- ---------------------------------------------------------------------------

ALTER TABLE "TenantUser"
ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

ALTER TABLE "TenantUser"
ADD COLUMN IF NOT EXISTS "pinHash" TEXT;

CREATE INDEX IF NOT EXISTS "TenantUser_tenantId_idx"
ON "TenantUser"("tenantId");

CREATE INDEX IF NOT EXISTS "TenantUser_status_idx"
ON "TenantUser"("status");

CREATE INDEX IF NOT EXISTS "User_tenantId_idx"
ON "User"("tenantId");

-- ---------------------------------------------------------------------------
-- ParkingSpaceTypeStyle
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "ParkingSpaceTypeStyle" (
  "id" TEXT NOT NULL,
  "type" "SpaceType" NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT,
  "strokeColor" TEXT NOT NULL DEFAULT '#475569',
  "fillColor" TEXT NOT NULL DEFAULT '#E5E7EB',
  "textColor" TEXT NOT NULL DEFAULT '#0F172A',
  "iconKey" TEXT,
  "iconUrl" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 100,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ParkingSpaceTypeStyle_pkey"
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS
  "ParkingSpaceTypeStyle_type_key"
ON "ParkingSpaceTypeStyle"("type");

CREATE INDEX IF NOT EXISTS
  "ParkingSpaceTypeStyle_isActive_displayOrder_idx"
ON "ParkingSpaceTypeStyle"(
  "isActive",
  "displayOrder"
);

-- ---------------------------------------------------------------------------
-- ControlService
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "ControlService" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "host" TEXT,
  "port" INTEGER,
  "commandType" TEXT NOT NULL DEFAULT 'systemctl',
  "targetName" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ControlService_pkey"
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ControlService_key_key"
ON "ControlService"("key");
