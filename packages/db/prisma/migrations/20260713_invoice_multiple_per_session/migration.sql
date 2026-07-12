-- Allow multiple invoices per parking session.
-- This supports:
-- 1) paid base parking invoice
-- 2) separate unpaid additional-fee invoice

ALTER TABLE "Invoice" DROP CONSTRAINT IF EXISTS "Invoice_sessionId_key";
DROP INDEX IF EXISTS "Invoice_sessionId_key";

CREATE INDEX IF NOT EXISTS "Invoice_sessionId_idx"
  ON "Invoice"("sessionId");

CREATE INDEX IF NOT EXISTS "Invoice_sessionId_status_idx"
  ON "Invoice"("sessionId", status);

CREATE INDEX IF NOT EXISTS "Invoice_sessionId_kind_idx"
  ON "Invoice"("sessionId", ((metadata->>'invoiceKind')));
