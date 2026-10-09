-- Índices de rendimiento para los listados y reportes por sucursal y fecha
-- (kardex, movimientos, compras). Idempotente: si alguien ya los creó a mano
-- en producción, la migración no falla.
CREATE INDEX IF NOT EXISTS "InventoryMovement_branchId_createdAt_idx" ON "InventoryMovement"("branchId", "createdAt");
CREATE INDEX IF NOT EXISTS "GoodsReceipt_branchId_createdAt_idx" ON "GoodsReceipt"("branchId", "createdAt");
