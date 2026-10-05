-- Ronda 4 (Claude)

-- Equipos: aprobación por gerente y secreto del dispositivo.
ALTER TABLE "Terminal"
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedBy" UUID,
  ADD COLUMN "secretHash" TEXT,
  ADD COLUMN "createdBy" UUID,
  ADD COLUMN "lastUserId" UUID;
-- Los equipos ya registrados operaban: quedan aprobados. Su secreto se fija en
-- el próximo registro desde ese dispositivo.
UPDATE "Terminal" SET "approvedAt" = "createdAt" WHERE "revokedAt" IS NULL;

-- Compras sin orden: proveedor, total y comprobante en la recepción.
ALTER TABLE "GoodsReceipt"
  ADD COLUMN "supplierId" UUID,
  ADD COLUMN "total" DECIMAL(14,2),
  ADD COLUMN "attachmentId" UUID,
  ADD COLUMN "operationId" UUID;
CREATE UNIQUE INDEX "GoodsReceipt_operationId_key" ON "GoodsReceipt"("operationId");
CREATE INDEX "GoodsReceipt_supplierId_createdAt_idx" ON "GoodsReceipt"("supplierId", "createdAt");

-- Integridad del kardex: un movimiento sólo puede apuntar a un lote existente.
-- Las referencias huérfanas (posibles por el fallo de la ronda 3) se anulan.
UPDATE "InventoryMovement" m SET "lotId" = NULL
  WHERE m."lotId" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "Lot" l WHERE l."id" = m."lotId");
ALTER TABLE "InventoryMovement"
  ADD CONSTRAINT "InventoryMovement_lotId_fkey"
  FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
