-- Índices no únicos: conservan todas las filas históricas, incluso con
-- sucursal y fecha repetidas. La reaplicación no recrea índices existentes.
CREATE INDEX IF NOT EXISTS "InventoryMovement_branchId_createdAt_idx"
  ON "InventoryMovement" ("branchId", "createdAt");
CREATE INDEX IF NOT EXISTS "GoodsReceipt_branchId_createdAt_idx"
  ON "GoodsReceipt" ("branchId", "createdAt");
