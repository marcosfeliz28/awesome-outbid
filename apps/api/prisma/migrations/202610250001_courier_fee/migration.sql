-- Aditiva: las ventas anteriores reciben envío cero, sin recalcular dinero.
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "courierFee" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "courierName" TEXT DEFAULT 'Addison';
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "courierPaidAt" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "courierPaidById" UUID;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sale_courier_fee_nonnegative') THEN
    ALTER TABLE "Sale" ADD CONSTRAINT sale_courier_fee_nonnegative CHECK ("courierFee" >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Sale_courierPaidById_fkey') THEN
    ALTER TABLE "Sale" ADD CONSTRAINT "Sale_courierPaidById_fkey" FOREIGN KEY ("courierPaidById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "CourierPayout" (
  "operationId" UUID PRIMARY KEY,
  "branchId" TEXT NOT NULL,
  "actorId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "note" TEXT,
  "requestHash" TEXT NOT NULL,
  "total" DECIMAL(14,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CourierPayout_branchId_createdAt_idx" ON "CourierPayout"("branchId", "createdAt");
CREATE TABLE IF NOT EXISTS "CourierPayoutItem" (
  "id" UUID PRIMARY KEY,
  "payoutId" UUID NOT NULL REFERENCES "CourierPayout"("operationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  "saleId" UUID NOT NULL UNIQUE REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "fee" DECIMAL(12,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS "CourierPayoutItem_payoutId_idx" ON "CourierPayoutItem"("payoutId");
