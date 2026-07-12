-- Compatibility bridge for moving Invoice from 1:1 to 1:N.
-- ParkingSession.invoice remains as a primary invoice relation for old API code.
-- ParkingSession.invoices supports multiple invoices per session.

ALTER TABLE "ParkingSession"
  ADD COLUMN IF NOT EXISTS "primaryInvoiceId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ParkingSession_primaryInvoiceId_key"
  ON "ParkingSession"("primaryInvoiceId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ParkingSession_primaryInvoiceId_fkey'
      AND table_name = 'ParkingSession'
  ) THEN
    ALTER TABLE "ParkingSession"
      ADD CONSTRAINT "ParkingSession_primaryInvoiceId_fkey"
      FOREIGN KEY ("primaryInvoiceId")
      REFERENCES "Invoice"(id)
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

UPDATE "ParkingSession" s
SET "primaryInvoiceId" = base_invoice.id
FROM LATERAL (
  SELECT i.id
  FROM "Invoice" i
  WHERE i."sessionId" = s.id
    AND COALESCE(i.metadata->>'invoiceKind', 'PARKING_FEE') <> 'ADDITIONAL_FEE'
  ORDER BY i."createdAt" ASC
  LIMIT 1
) base_invoice
WHERE s."primaryInvoiceId" IS NULL;
