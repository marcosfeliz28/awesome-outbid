-- GV: foto del voucher/comprobante de cada pago con tarjeta o transferencia y
-- foto del cierre de lote de la caja (orden de la dueña, 5-nov). Solo aditiva:
-- una tabla nueva; no toca GvPayment, GvCashSession ni nada de MacGen.
CREATE TABLE IF NOT EXISTS "GvProof" (
  "id" UUID NOT NULL,
  "paymentId" UUID,
  "cashSessionId" UUID,
  "contentType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "data" BYTEA NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GvProof_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "gv_proof_one_owner" CHECK (("paymentId" IS NULL) <> ("cashSessionId" IS NULL)),
  CONSTRAINT "gv_proof_type" CHECK ("contentType" IN ('image/jpeg','image/png','image/webp','application/pdf')),
  CONSTRAINT "gv_proof_size" CHECK ("size" > 0 AND "size" <= 2097152)
);
CREATE UNIQUE INDEX IF NOT EXISTS "GvProof_paymentId_key" ON "GvProof" ("paymentId");
CREATE UNIQUE INDEX IF NOT EXISTS "GvProof_cashSessionId_key" ON "GvProof" ("cashSessionId");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GvProof_paymentId_fkey') THEN
    ALTER TABLE "GvProof" ADD CONSTRAINT "GvProof_paymentId_fkey"
      FOREIGN KEY ("paymentId") REFERENCES "GvPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GvProof_cashSessionId_fkey') THEN
    ALTER TABLE "GvProof" ADD CONSTRAINT "GvProof_cashSessionId_fkey"
      FOREIGN KEY ("cashSessionId") REFERENCES "GvCashSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
