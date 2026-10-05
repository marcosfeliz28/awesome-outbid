-- Auditoría ronda 4 (ChatGPT, P2): índice para la relación del kardex con el lote.
CREATE INDEX "InventoryMovement_lotId_idx" ON "InventoryMovement"("lotId");
