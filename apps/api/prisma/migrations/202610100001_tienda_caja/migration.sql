-- Tienda (6/10/2026) · cuadre de caja y datos impresos.
-- Número y nombre de la caja (equipo), número de cajero y el detalle del
-- cierre (denominaciones, vales, US$/€, entregado y dejado). Todo es opcional:
-- los equipos, usuarios y cajas existentes quedan sin número y sin detalle.
-- Re-ejecutable: IF NOT EXISTS.
ALTER TABLE "Terminal" ADD COLUMN IF NOT EXISTS "registerNumber" INTEGER;
ALTER TABLE "Terminal" ADD COLUMN IF NOT EXISTS "registerName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cashierNumber" INTEGER;
ALTER TABLE "CashSession" ADD COLUMN IF NOT EXISTS "closeDetails" JSONB;
-- Dos cajas activas o dos cajeros activos de la sucursal no comparten número.
CREATE UNIQUE INDEX IF NOT EXISTS "Terminal_branch_registerNumber_active_key"
  ON "Terminal" ("branchId", "registerNumber")
  WHERE "registerNumber" IS NOT NULL AND "revokedAt" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "User_branch_cashierNumber_active_key"
  ON "User" ("branchId", "cashierNumber")
  WHERE "cashierNumber" IS NOT NULL AND "active";
