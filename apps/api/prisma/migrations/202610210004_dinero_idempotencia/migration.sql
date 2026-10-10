-- Nombre 202610210004 (no 202610210001, el de la rama fix-dinero): en la
-- integración chocaba con 202610210001_datos_indices y las migraciones no
-- deben repetir prefijo (docs/MIGRACIONES_SEGURAS.md, M2). Es independiente
-- de las de datos y nunca se aplicó en producción.
--
-- D-M4 (auditoría 06): clave de idempotencia de los movimientos de caja, los
-- pagos a proveedor y los gastos. Un doble clic o un reintento con la misma
-- clave devuelve el registro ya creado en vez de duplicarlo.
--
-- Idempotente y sin riesgo para un despliegue: columnas nuevas nulas (sin
-- reescribir la tabla) y únicos que sólo pueden chocar entre claves nuevas;
-- las filas existentes quedan con NULL, que no colisiona.
ALTER TABLE "CashMovement" ADD COLUMN IF NOT EXISTS "operationId" UUID;
ALTER TABLE "SupplierPayment" ADD COLUMN IF NOT EXISTS "operationId" UUID;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "operationId" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "CashMovement_operationId_key" ON "CashMovement"("operationId");
CREATE UNIQUE INDEX IF NOT EXISTS "SupplierPayment_operationId_key" ON "SupplierPayment"("operationId");
CREATE UNIQUE INDEX IF NOT EXISTS "Expense_operationId_key" ON "Expense"("operationId");
