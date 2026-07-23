-- Reconcile Tenant profile fields across Cloud and Edge databases.
-- This migration is intentionally idempotent because historical databases
-- were provisioned through different migration and manual reconciliation paths.

BEGIN;

ALTER TABLE public."Tenant"
  ADD COLUMN IF NOT EXISTS "parkingLotId" TEXT,
  ADD COLUMN IF NOT EXISTS "businessNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "representative" TEXT,
  ADD COLUMN IF NOT EXISTS "contact" TEXT,
  ADD COLUMN IF NOT EXISTS "billingEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "memo" TEXT,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;

-- Handle a partially created nullable isActive column.
UPDATE public."Tenant"
SET "isActive" = true
WHERE "isActive" IS NULL;

ALTER TABLE public."Tenant"
  ALTER COLUMN "isActive" SET DEFAULT true,
  ALTER COLUMN "isActive" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Tenant_parkingLotId_idx"
  ON public."Tenant" ("parkingLotId");

CREATE INDEX IF NOT EXISTS "Tenant_isActive_idx"
  ON public."Tenant" ("isActive");

CREATE INDEX IF NOT EXISTS "Tenant_createdAt_idx"
  ON public."Tenant" ("createdAt");

DO $$
BEGIN
  IF
    to_regclass('public."ParkingLot"') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE
        conrelid = 'public."Tenant"'::regclass
        AND conname = 'Tenant_parkingLotId_fkey'
    )
  THEN
    ALTER TABLE public."Tenant"
      ADD CONSTRAINT "Tenant_parkingLotId_fkey"
      FOREIGN KEY ("parkingLotId")
      REFERENCES public."ParkingLot"("id")
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END
$$;

COMMIT;
