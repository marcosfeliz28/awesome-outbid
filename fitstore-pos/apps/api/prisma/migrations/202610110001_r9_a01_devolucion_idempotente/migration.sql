-- R9-A01 (auditoría de ChatGPT a la ronda 9): una devolución repetida con la
-- misma clave de operación devuelve la original en vez de crear otra nota de
-- crédito y reponer el stock dos veces. Las devoluciones anteriores quedan
-- sin clave. Re-ejecutable: IF NOT EXISTS.
ALTER TABLE "SaleReturn" ADD COLUMN IF NOT EXISTS "operationId" UUID;
CREATE UNIQUE INDEX IF NOT EXISTS "SaleReturn_operationId_key" ON "SaleReturn"("operationId");
