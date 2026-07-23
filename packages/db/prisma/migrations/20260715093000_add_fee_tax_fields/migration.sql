DO $$
BEGIN
  CREATE TYPE "FeeTaxType" AS ENUM ('VAT_INCLUDED', 'TAX_EXEMPT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "FeePolicy"
  ADD COLUMN IF NOT EXISTS "taxType" "FeeTaxType" NOT NULL DEFAULT 'VAT_INCLUDED';

ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "taxType" "FeeTaxType" NOT NULL DEFAULT 'VAT_INCLUDED',
  ADD COLUMN IF NOT EXISTS "supplyAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "vatAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "taxExemptAmount" INTEGER NOT NULL DEFAULT 0;

WITH invoice_totals AS (
  SELECT
    id,
    GREATEST(COALESCE(NULLIF("finalAmount", 0), "amount", 0), 0) AS total_amount
  FROM "Invoice"
)
UPDATE "Invoice" i
SET
  "supplyAmount" = ROUND(t.total_amount::numeric * 10 / 11)::int,
  "vatAmount" = t.total_amount - ROUND(t.total_amount::numeric * 10 / 11)::int,
  "taxExemptAmount" = 0,
  "taxType" = 'VAT_INCLUDED'
FROM invoice_totals t
WHERE i.id = t.id
  AND i."taxType" = 'VAT_INCLUDED'
  AND i."supplyAmount" = 0
  AND i."vatAmount" = 0
  AND t.total_amount > 0;
