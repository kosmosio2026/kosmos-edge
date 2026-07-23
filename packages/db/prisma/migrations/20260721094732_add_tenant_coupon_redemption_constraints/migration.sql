BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "TenantCoupon"
    WHERE "reservedSessionId" IS NOT NULL
    GROUP BY "reservedSessionId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate TenantCoupon.reservedSessionId values exist';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "TenantCoupon"
    WHERE "usedSessionId" IS NOT NULL
    GROUP BY "usedSessionId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate TenantCoupon.usedSessionId values exist';
  END IF;
END $$;

DROP INDEX IF EXISTS "TenantCoupon_reservedSessionId_idx";
DROP INDEX IF EXISTS "TenantCoupon_usedSessionId_idx";

CREATE UNIQUE INDEX "TenantCoupon_reservedSessionId_key"
  ON "TenantCoupon"("reservedSessionId");

CREATE UNIQUE INDEX "TenantCoupon_usedSessionId_key"
  ON "TenantCoupon"("usedSessionId");

COMMIT;
