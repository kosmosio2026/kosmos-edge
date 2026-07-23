-- Repair missing TenantApplication database objects.
--
-- Cloud already has these objects.
-- Edge databases created before this migration may not.
-- Every operation is guarded so this migration is safe
-- for Cloud, connected Edge and Edge Standalone.

DO $$
BEGIN
  IF to_regtype(
    'public."TenantApplicationStatus"'
  ) IS NULL THEN
    EXECUTE $ddl$
CREATE TYPE "TenantApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
    $ddl$;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "TenantApplication" (
    "id" TEXT NOT NULL,
    "parkingLotId" TEXT NOT NULL,
    "managementCompanyId" TEXT,
    "tenantId" TEXT,
    "companyName" TEXT NOT NULL,
    "businessNumber" TEXT,
    "representative" TEXT,
    "contact" TEXT,
    "billingEmail" TEXT,
    "applicantName" TEXT,
    "applicantPhone" TEXT,
    "applicantEmail" TEXT,
    "memo" TEXT,
    "status" "TenantApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pinHash" TEXT,

    CONSTRAINT "TenantApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TenantApplication_parkingLotId_idx" ON "TenantApplication"("parkingLotId");

CREATE INDEX IF NOT EXISTS "TenantApplication_managementCompanyId_idx" ON "TenantApplication"("managementCompanyId");

CREATE INDEX IF NOT EXISTS "TenantApplication_tenantId_idx" ON "TenantApplication"("tenantId");

CREATE INDEX IF NOT EXISTS "TenantApplication_status_idx" ON "TenantApplication"("status");

CREATE INDEX IF NOT EXISTS "TenantApplication_createdAt_idx" ON "TenantApplication"("createdAt");

CREATE INDEX IF NOT EXISTS "TenantApplication_businessNumber_idx" ON "TenantApplication"("businessNumber");

DO $$
BEGIN
  IF to_regclass(
    'public."TenantApplication"'
  ) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TenantApplication_parkingLotId_fkey'
      AND conrelid =
        'public."TenantApplication"'::regclass
  ) THEN
    ALTER TABLE "TenantApplication" ADD CONSTRAINT "TenantApplication_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass(
    'public."TenantApplication"'
  ) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TenantApplication_managementCompanyId_fkey'
      AND conrelid =
        'public."TenantApplication"'::regclass
  ) THEN
    ALTER TABLE "TenantApplication" ADD CONSTRAINT "TenantApplication_managementCompanyId_fkey" FOREIGN KEY ("managementCompanyId") REFERENCES "ManagementCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass(
    'public."TenantApplication"'
  ) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TenantApplication_tenantId_fkey'
      AND conrelid =
        'public."TenantApplication"'::regclass
  ) THEN
    ALTER TABLE "TenantApplication" ADD CONSTRAINT "TenantApplication_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass(
    'public."TenantApplication"'
  ) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TenantApplication_approvedByUserId_fkey'
      AND conrelid =
        'public."TenantApplication"'::regclass
  ) THEN
    ALTER TABLE "TenantApplication" ADD CONSTRAINT "TenantApplication_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass(
    'public."TenantApplication"'
  ) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'TenantApplication_rejectedByUserId_fkey'
      AND conrelid =
        'public."TenantApplication"'::regclass
  ) THEN
    ALTER TABLE "TenantApplication" ADD CONSTRAINT "TenantApplication_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
