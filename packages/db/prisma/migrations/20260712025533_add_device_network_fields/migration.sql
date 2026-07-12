ALTER TABLE "Device"
  ADD COLUMN IF NOT EXISTS "macAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "ipAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "installLocation" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Device_macAddress_key"
  ON "Device"("macAddress");
