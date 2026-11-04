-- GV: caja propia (opción B, orden 106/4-nov). Solo aditiva: tabla nueva y dos
-- columnas nulas en GvPayment. No toca CashSession ni nada de MacGen.
CREATE TABLE IF NOT EXISTS "GvCashSession" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "branchId" TEXT NOT NULL DEFAULT 'main',
  "userId" TEXT NOT NULL,
  "openingAmount" DECIMAL(14,2) NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "closedBy" TEXT,
  "expectedCash" DECIMAL(14,2),
  "countedCash" DECIMAL(14,2),
  "expectedCard" DECIMAL(14,2),
  "countedCard" DECIMAL(14,2),
  "expectedTransfer" DECIMAL(14,2),
  "countedTransfer" DECIMAL(14,2),
  "difference" DECIMAL(14,2),
  "notes" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "GvCashSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "gv_cash_opening_nonnegative" CHECK ("openingAmount" >= 0),
  CONSTRAINT "gv_cash_closed_after_opened" CHECK ("closedAt" IS NULL OR "closedAt" >= "openedAt")
);
-- Una sola caja GV abierta por sucursal.
CREATE UNIQUE INDEX IF NOT EXISTS "gv_cash_one_open" ON "GvCashSession" ("branchId") WHERE "closedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "GvCashSession_branchId_openedAt_idx" ON "GvCashSession" ("branchId", "openedAt");

ALTER TABLE "GvPayment" ADD COLUMN IF NOT EXISTS "cashSessionId" UUID;
ALTER TABLE "GvPayment" ADD COLUMN IF NOT EXISTS "receiptNumber" TEXT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GvPayment_cashSessionId_fkey') THEN
    ALTER TABLE "GvPayment" ADD CONSTRAINT "GvPayment_cashSessionId_fkey"
      FOREIGN KEY ("cashSessionId") REFERENCES "GvCashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "GvPayment_branchId_receiptNumber_key" ON "GvPayment" ("branchId", "receiptNumber");
CREATE INDEX IF NOT EXISTS "GvPayment_cashSessionId_idx" ON "GvPayment" ("cashSessionId");
