-- PQ-25 (orden 105): índices para consultas de reportes. Aditivo e idempotente;
-- Sin modo concurrente: Prisma ejecuta cada migración en una transacción.
CREATE INDEX IF NOT EXISTS "Sale_branchId_status_createdAt_idx" ON "Sale"("branchId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "SaleReturn_branchId_createdAt_idx" ON "SaleReturn"("branchId", "createdAt");
CREATE INDEX IF NOT EXISTS "Payment_entryType_createdAt_idx" ON "Payment"("entryType", "createdAt");
CREATE INDEX IF NOT EXISTS "CashSession_branchId_openedAt_idx" ON "CashSession"("branchId", "openedAt");
