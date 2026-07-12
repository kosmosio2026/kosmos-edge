ALTER TABLE "SensorDevice"
  ADD COLUMN IF NOT EXISTS "macAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "ipAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "installLocation" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "SensorDevice_macAddress_key"
  ON "SensorDevice"("macAddress");
