-- Repair tenant runtime tables missing from Edge databases.
--
-- Cloud already contains these database objects.
-- Connected Edge and Edge Standalone may not contain them.
-- All operations are guarded and contain no destructive DDL.

DO $$
BEGIN
  IF to_regtype(
    'public."TenantVisitConfirmationStatus"'
  ) IS NULL THEN
    EXECUTE $ddl$
-- CreateEnum
CREATE TYPE "TenantVisitConfirmationStatus" AS ENUM ('CONFIRMED', 'CANCELLED');
    $ddl$;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regtype(
    'public."TenantChargeType"'
  ) IS NULL THEN
    EXECUTE $ddl$
-- CreateEnum
CREATE TYPE "TenantChargeType" AS ENUM ('VISIT_PARKING_FEE', 'ADJUSTMENT', 'CANCEL');
    $ddl$;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regtype(
    'public."TenantChargeStatus"'
  ) IS NULL THEN
    EXECUTE $ddl$
-- CreateEnum
CREATE TYPE "TenantChargeStatus" AS ENUM ('PENDING', 'STATEMENT_DRAFTED', 'STATEMENT_CLOSED', 'CANCELLED');
    $ddl$;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regtype(
    'public."TenantMonthlyStatementStatus"'
  ) IS NULL THEN
    EXECUTE $ddl$
-- CreateEnum
CREATE TYPE "TenantMonthlyStatementStatus" AS ENUM ('DRAFT', 'CLOSED', 'INVOICED', 'PAID', 'CANCELLED');
    $ddl$;
  END IF;
END
$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "TenantAppCredential" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessNumber" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "pinUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantAppCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TenantVisitConfirmation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "parkingSessionId" TEXT NOT NULL,
    "parkingLotId" TEXT NOT NULL,
    "parkingSectionId" TEXT,
    "parkingSpaceId" TEXT,
    "confirmedByUserId" TEXT,
    "confirmedByCredentialId" TEXT,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vehiclePlate" TEXT,
    "contactPhone" TEXT,
    "entryTime" TIMESTAMP(3),
    "coveredAmount" INTEGER NOT NULL DEFAULT 0,
    "coveredUntil" TIMESTAMP(3),
    "graceMinutes" INTEGER NOT NULL,
    "graceUntil" TIMESTAMP(3),
    "note" TEXT,
    "status" "TenantVisitConfirmationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantVisitConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TenantMonthlyStatement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "parkingLotId" TEXT NOT NULL,
    "managementCompanyId" TEXT NOT NULL,
    "billingMonth" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "status" "TenantMonthlyStatementStatus" NOT NULL DEFAULT 'DRAFT',
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantMonthlyStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TenantCharge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "parkingSessionId" TEXT NOT NULL,
    "tenantVisitConfirmationId" TEXT,
    "parkingLotId" TEXT NOT NULL,
    "parkingSpaceId" TEXT,
    "chargeType" "TenantChargeType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "billingMonth" TEXT NOT NULL,
    "status" "TenantChargeStatus" NOT NULL DEFAULT 'PENDING',
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantAppCredential_tenantId_key" ON "TenantAppCredential"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantAppCredential_businessNumber_key" ON "TenantAppCredential"("businessNumber");

-- CreateIndex
CREATE INDEX "TenantAppCredential_businessNumber_idx" ON "TenantAppCredential"("businessNumber");

-- CreateIndex
CREATE INDEX "TenantAppCredential_tenantId_idx" ON "TenantAppCredential"("tenantId");

-- CreateIndex
CREATE INDEX "TenantVisitConfirmation_tenantId_idx" ON "TenantVisitConfirmation"("tenantId");

-- CreateIndex
CREATE INDEX "TenantVisitConfirmation_parkingSessionId_idx" ON "TenantVisitConfirmation"("parkingSessionId");

-- CreateIndex
CREATE INDEX "TenantVisitConfirmation_parkingLotId_idx" ON "TenantVisitConfirmation"("parkingLotId");

-- CreateIndex
CREATE INDEX "TenantVisitConfirmation_parkingSpaceId_idx" ON "TenantVisitConfirmation"("parkingSpaceId");

-- CreateIndex
CREATE INDEX "TenantVisitConfirmation_confirmedByUserId_idx" ON "TenantVisitConfirmation"("confirmedByUserId");

-- CreateIndex
CREATE INDEX "TenantVisitConfirmation_confirmedByCredentialId_idx" ON "TenantVisitConfirmation"("confirmedByCredentialId");

-- CreateIndex
CREATE INDEX "TenantVisitConfirmation_confirmedAt_idx" ON "TenantVisitConfirmation"("confirmedAt");

-- CreateIndex
CREATE INDEX "TenantVisitConfirmation_status_idx" ON "TenantVisitConfirmation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TenantVisitConfirmation_parkingSessionId_tenantId_key" ON "TenantVisitConfirmation"("parkingSessionId", "tenantId");

-- CreateIndex
CREATE INDEX "TenantCharge_tenantId_idx" ON "TenantCharge"("tenantId");

-- CreateIndex
CREATE INDEX "TenantCharge_parkingSessionId_idx" ON "TenantCharge"("parkingSessionId");

-- CreateIndex
CREATE INDEX "TenantCharge_tenantVisitConfirmationId_idx" ON "TenantCharge"("tenantVisitConfirmationId");

-- CreateIndex
CREATE INDEX "TenantCharge_parkingLotId_idx" ON "TenantCharge"("parkingLotId");

-- CreateIndex
CREATE INDEX "TenantCharge_parkingSpaceId_idx" ON "TenantCharge"("parkingSpaceId");

-- CreateIndex
CREATE INDEX "TenantCharge_billingMonth_idx" ON "TenantCharge"("billingMonth");

-- CreateIndex
CREATE INDEX "TenantCharge_status_idx" ON "TenantCharge"("status");

-- CreateIndex
CREATE INDEX "TenantCharge_occurredAt_idx" ON "TenantCharge"("occurredAt");

-- CreateIndex
CREATE INDEX "TenantMonthlyStatement_parkingLotId_idx" ON "TenantMonthlyStatement"("parkingLotId");

-- CreateIndex
CREATE INDEX "TenantMonthlyStatement_managementCompanyId_idx" ON "TenantMonthlyStatement"("managementCompanyId");

-- CreateIndex
CREATE INDEX "TenantMonthlyStatement_billingMonth_idx" ON "TenantMonthlyStatement"("billingMonth");

-- CreateIndex
CREATE INDEX "TenantMonthlyStatement_status_idx" ON "TenantMonthlyStatement"("status");

-- CreateIndex
CREATE INDEX "TenantMonthlyStatement_closedByUserId_idx" ON "TenantMonthlyStatement"("closedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantMonthlyStatement_tenantId_billingMonth_key" ON "TenantMonthlyStatement"("tenantId", "billingMonth");

DO $$
BEGIN
  IF to_regclass(
    'public."TenantAppCredential"'
  ) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TenantAppCredential_tenantId_fkey'
      AND conrelid =
        'public."TenantAppCredential"'::regclass
  ) THEN
    -- AddForeignKey
    ALTER TABLE "TenantAppCredential" ADD CONSTRAINT "TenantAppCredential_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass(
    'public."TenantVisitConfirmation"'
  ) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TenantVisitConfirmation_tenantId_fkey'
      AND conrelid =
        'public."TenantVisitConfirmation"'::regclass
  ) THEN
    -- AddForeignKey
    ALTER TABLE "TenantVisitConfirmation" ADD CONSTRAINT "TenantVisitConfirmation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass(
    'public."TenantVisitConfirmation"'
  ) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TenantVisitConfirmation_parkingSessionId_fkey'
      AND conrelid =
        'public."TenantVisitConfirmation"'::regclass
  ) THEN
    -- AddForeignKey
    ALTER TABLE "TenantVisitConfirmation" ADD CONSTRAINT "TenantVisitConfirmation_parkingSessionId_fkey" FOREIGN KEY ("parkingSessionId") REFERENCES "ParkingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass(
    'public."TenantVisitConfirmation"'
  ) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TenantVisitConfirmation_parkingLotId_fkey'
      AND conrelid =
        'public."TenantVisitConfirmation"'::regclass
  ) THEN
    -- AddForeignKey
    ALTER TABLE "TenantVisitConfirmation" ADD CONSTRAINT "TenantVisitConfirmation_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass(
    'public."TenantVisitConfirmation"'
  ) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TenantVisitConfirmation_parkingSpaceId_fkey'
      AND conrelid =
        'public."TenantVisitConfirmation"'::regclass
  ) THEN
    -- AddForeignKey
    ALTER TABLE "TenantVisitConfirmation" ADD CONSTRAINT "TenantVisitConfirmation_parkingSpaceId_fkey" FOREIGN KEY ("parkingSpaceId") REFERENCES "ParkingSpace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass(
    'public."TenantVisitConfirmation"'
  ) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TenantVisitConfirmation_confirmedByUserId_fkey'
      AND conrelid =
        'public."TenantVisitConfirmation"'::regclass
  ) THEN
    -- AddForeignKey
    ALTER TABLE "TenantVisitConfirmation" ADD CONSTRAINT "TenantVisitConfirmation_confirmedByUserId_fkey" FOREIGN KEY ("confirmedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass(
    'public."TenantVisitConfirmation"'
  ) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TenantVisitConfirmation_confirmedByCredentialId_fkey'
      AND conrelid =
        'public."TenantVisitConfirmation"'::regclass
  ) THEN
    -- AddForeignKey
    ALTER TABLE "TenantVisitConfirmation" ADD CONSTRAINT "TenantVisitConfirmation_confirmedByCredentialId_fkey" FOREIGN KEY ("confirmedByCredentialId") REFERENCES "TenantAppCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass(
    'public."TenantCharge"'
  ) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TenantCharge_tenantId_fkey'
      AND conrelid =
        'public."TenantCharge"'::regclass
  ) THEN
    -- AddForeignKey
    ALTER TABLE "TenantCharge" ADD CONSTRAINT "TenantCharge_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass(
    'public."TenantCharge"'
  ) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TenantCharge_parkingSessionId_fkey'
      AND conrelid =
        'public."TenantCharge"'::regclass
  ) THEN
    -- AddForeignKey
    ALTER TABLE "TenantCharge" ADD CONSTRAINT "TenantCharge_parkingSessionId_fkey" FOREIGN KEY ("parkingSessionId") REFERENCES "ParkingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass(
    'public."TenantCharge"'
  ) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TenantCharge_tenantVisitConfirmationId_fkey'
      AND conrelid =
        'public."TenantCharge"'::regclass
  ) THEN
    -- AddForeignKey
    ALTER TABLE "TenantCharge" ADD CONSTRAINT "TenantCharge_tenantVisitConfirmationId_fkey" FOREIGN KEY ("tenantVisitConfirmationId") REFERENCES "TenantVisitConfirmation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass(
    'public."TenantCharge"'
  ) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TenantCharge_parkingLotId_fkey'
      AND conrelid =
        'public."TenantCharge"'::regclass
  ) THEN
    -- AddForeignKey
    ALTER TABLE "TenantCharge" ADD CONSTRAINT "TenantCharge_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass(
    'public."TenantCharge"'
  ) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TenantCharge_parkingSpaceId_fkey'
      AND conrelid =
        'public."TenantCharge"'::regclass
  ) THEN
    -- AddForeignKey
    ALTER TABLE "TenantCharge" ADD CONSTRAINT "TenantCharge_parkingSpaceId_fkey" FOREIGN KEY ("parkingSpaceId") REFERENCES "ParkingSpace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass(
    'public."TenantMonthlyStatement"'
  ) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TenantMonthlyStatement_tenantId_fkey'
      AND conrelid =
        'public."TenantMonthlyStatement"'::regclass
  ) THEN
    -- AddForeignKey
    ALTER TABLE "TenantMonthlyStatement" ADD CONSTRAINT "TenantMonthlyStatement_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass(
    'public."TenantMonthlyStatement"'
  ) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TenantMonthlyStatement_parkingLotId_fkey'
      AND conrelid =
        'public."TenantMonthlyStatement"'::regclass
  ) THEN
    -- AddForeignKey
    ALTER TABLE "TenantMonthlyStatement" ADD CONSTRAINT "TenantMonthlyStatement_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass(
    'public."TenantMonthlyStatement"'
  ) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TenantMonthlyStatement_managementCompanyId_fkey'
      AND conrelid =
        'public."TenantMonthlyStatement"'::regclass
  ) THEN
    -- AddForeignKey
    ALTER TABLE "TenantMonthlyStatement" ADD CONSTRAINT "TenantMonthlyStatement_managementCompanyId_fkey" FOREIGN KEY ("managementCompanyId") REFERENCES "ManagementCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass(
    'public."TenantMonthlyStatement"'
  ) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TenantMonthlyStatement_closedByUserId_fkey'
      AND conrelid =
        'public."TenantMonthlyStatement"'::regclass
  ) THEN
    -- AddForeignKey
    ALTER TABLE "TenantMonthlyStatement" ADD CONSTRAINT "TenantMonthlyStatement_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
