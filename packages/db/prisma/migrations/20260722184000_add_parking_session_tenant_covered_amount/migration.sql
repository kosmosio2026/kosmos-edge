-- Repair schema drift found during fresh database initialization.
-- Existing databases may already have this column, while fresh databases
-- created only from migration history do not.

ALTER TABLE "ParkingSession"
ADD COLUMN IF NOT EXISTS "tenantCoveredAmount" INTEGER;

UPDATE "ParkingSession"
SET "tenantCoveredAmount" = 0
WHERE "tenantCoveredAmount" IS NULL;

ALTER TABLE "ParkingSession"
ALTER COLUMN "tenantCoveredAmount" SET DEFAULT 0;

ALTER TABLE "ParkingSession"
ALTER COLUMN "tenantCoveredAmount" SET NOT NULL;
