-- Reconcile ParkingLot.operationMode for databases where the column
-- may already have been added manually or through schema synchronization.
--
-- This migration is intentionally idempotent:
-- - Existing Cloud/Edge databases remain unchanged.
-- - A new database built from migrations receives the missing column/index.

BEGIN;

ALTER TABLE "ParkingLot"
  ADD COLUMN IF NOT EXISTS "operationMode" TEXT;

UPDATE "ParkingLot"
SET "operationMode" = 'SENSOR'
WHERE
  "operationMode" IS NULL
  OR btrim("operationMode") = '';

ALTER TABLE "ParkingLot"
  ALTER COLUMN "operationMode" SET DEFAULT 'SENSOR';

ALTER TABLE "ParkingLot"
  ALTER COLUMN "operationMode" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "ParkingLot_operationMode_idx"
  ON "ParkingLot"("operationMode");

COMMIT;
