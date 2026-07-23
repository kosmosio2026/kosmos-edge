-- ManagementCompany foundation
--
-- This migration is intentionally idempotent because existing Cloud and Edge
-- databases were provisioned through different historical paths.
--
-- ParkingLot.tenantId is intentionally preserved for now.

CREATE TABLE IF NOT EXISTS public."ManagementCompany" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "businessNumber" TEXT,
  "representative" TEXT,
  "contact" TEXT,
  "address" TEXT,
  "memo" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Handle a partially created ManagementCompany table safely.
ALTER TABLE public."ManagementCompany"
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "code" TEXT,
  ADD COLUMN IF NOT EXISTS "businessNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "representative" TEXT,
  ADD COLUMN IF NOT EXISTS "contact" TEXT,
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "memo" TEXT,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE
      conrelid = 'public."ManagementCompany"'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public."ManagementCompany"
      ADD CONSTRAINT "ManagementCompany_pkey"
      PRIMARY KEY ("id");
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "ManagementCompany_code_key"
  ON public."ManagementCompany" ("code");

CREATE INDEX IF NOT EXISTS "ManagementCompany_name_idx"
  ON public."ManagementCompany" ("name");

CREATE INDEX IF NOT EXISTS "ManagementCompany_isActive_idx"
  ON public."ManagementCompany" ("isActive");

CREATE INDEX IF NOT EXISTS "ManagementCompany_createdAt_idx"
  ON public."ManagementCompany" ("createdAt");

-- Nullable ManagementCompany relations.
DO $$
DECLARE
  relation RECORD;
BEGIN
  FOR relation IN
    SELECT *
    FROM (
      VALUES
        (
          'User',
          'User_managementCompanyId_idx',
          'User_managementCompanyId_fkey',
          'SET NULL'
        ),
        (
          'ManagerProfile',
          'ManagerProfile_managementCompanyId_idx',
          'ManagerProfile_managementCompanyId_fkey',
          'SET NULL'
        ),
        (
          'ParkingLot',
          'ParkingLot_managementCompanyId_idx',
          'ParkingLot_managementCompanyId_fkey',
          'SET NULL'
        ),
        (
          'EdgeNode',
          'EdgeNode_managementCompanyId_idx',
          'EdgeNode_managementCompanyId_fkey',
          'SET NULL'
        ),
        (
          'Tenant',
          'Tenant_managementCompanyId_idx',
          'Tenant_managementCompanyId_fkey',
          'SET NULL'
        ),
        (
          'TenantApplication',
          'TenantApplication_managementCompanyId_idx',
          'TenantApplication_managementCompanyId_fkey',
          'SET NULL'
        ),
        (
          'ApprovalRequest',
          'ApprovalRequest_managementCompanyId_idx',
          'ApprovalRequest_managementCompanyId_fkey',
          'SET NULL'
        )
    ) AS relations(
      table_name,
      index_name,
      constraint_name,
      delete_action
    )
  LOOP
    IF to_regclass(
      format('public.%I', relation.table_name)
    ) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I
         ADD COLUMN IF NOT EXISTS "managementCompanyId" TEXT',
        relation.table_name
      );

      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I
         ON public.%I ("managementCompanyId")',
        relation.index_name,
        relation.table_name
      );

      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = relation.constraint_name
      ) THEN
        EXECUTE format(
          'ALTER TABLE public.%I
           ADD CONSTRAINT %I
           FOREIGN KEY ("managementCompanyId")
           REFERENCES public."ManagementCompany"("id")
           ON UPDATE CASCADE
           ON DELETE %s',
          relation.table_name,
          relation.constraint_name,
          relation.delete_action
        );
      END IF;
    END IF;
  END LOOP;
END
$$;

-- TenantMonthlyStatement uses a required ManagementCompany relation in Prisma.
-- Add it as nullable first so databases containing historical rows do not fail.
DO $$
DECLARE
  remaining_null_count BIGINT;
BEGIN
  IF to_regclass(
    'public."TenantMonthlyStatement"'
  ) IS NOT NULL THEN
    ALTER TABLE public."TenantMonthlyStatement"
      ADD COLUMN IF NOT EXISTS "managementCompanyId" TEXT;

    -- Backfill through Tenant when the required columns are available.
    IF
      to_regclass('public."Tenant"') IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE
          table_schema = 'public'
          AND table_name = 'TenantMonthlyStatement'
          AND column_name = 'tenantId'
      )
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE
          table_schema = 'public'
          AND table_name = 'Tenant'
          AND column_name = 'managementCompanyId'
      )
    THEN
      UPDATE public."TenantMonthlyStatement" AS statement
      SET "managementCompanyId" = tenant."managementCompanyId"
      FROM public."Tenant" AS tenant
      WHERE
        statement."tenantId" = tenant."id"
        AND statement."managementCompanyId" IS NULL
        AND tenant."managementCompanyId" IS NOT NULL;
    END IF;

    CREATE INDEX IF NOT EXISTS
      "TenantMonthlyStatement_managementCompanyId_idx"
      ON public."TenantMonthlyStatement" ("managementCompanyId");

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE
        conname =
          'TenantMonthlyStatement_managementCompanyId_fkey'
    ) THEN
      ALTER TABLE public."TenantMonthlyStatement"
        ADD CONSTRAINT
          "TenantMonthlyStatement_managementCompanyId_fkey"
        FOREIGN KEY ("managementCompanyId")
        REFERENCES public."ManagementCompany"("id")
        ON UPDATE CASCADE
        ON DELETE CASCADE;
    END IF;

    SELECT COUNT(*)
    INTO remaining_null_count
    FROM public."TenantMonthlyStatement"
    WHERE "managementCompanyId" IS NULL;

    IF remaining_null_count = 0 THEN
      ALTER TABLE public."TenantMonthlyStatement"
        ALTER COLUMN "managementCompanyId" SET NOT NULL;
    ELSE
      RAISE NOTICE
        'TenantMonthlyStatement.managementCompanyId remains nullable: % historical row(s) require backfill',
        remaining_null_count;
    END IF;
  END IF;
END
$$;
