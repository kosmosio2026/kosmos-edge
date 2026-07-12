-- ParkingLot region/district cleanup
-- sido -> region, sigungu -> district
-- Safe for databases where legacy columns were already removed manually.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ParkingLot'
      AND column_name = 'sido'
  ) OR EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'ParkingLot'
      AND column_name = 'sigungu'
  ) THEN
    UPDATE "ParkingLot"
    SET
      region = COALESCE(NULLIF(region, ''), NULLIF(sido, '')),
      district = COALESCE(NULLIF(district, ''), NULLIF(sigungu, '')),
      "updatedAt" = now()
    WHERE
      (region IS NULL OR region = '')
      OR (district IS NULL OR district = '');
  END IF;
END $$;

ALTER TABLE "ParkingLot"
  DROP COLUMN IF EXISTS sido,
  DROP COLUMN IF EXISTS sigungu;
