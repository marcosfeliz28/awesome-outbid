-- Numeración de facturas y devoluciones por sucursal (auditoría de intrusión,
-- 10-nov). Sale.number y SaleReturn.number eran únicos en toda la base, pero el
-- contador es por sucursal: dos sucursales con el mismo valor chocaban (P2002).
-- Ahora la unicidad es (branchId, number). No se borra ni cambia ninguna fila:
-- lo que ya cumplía la regla estricta cumple la nueva.
-- Se crean primero los índices nuevos y después se sueltan los viejos.
-- lock_timeout: si Sale o SaleReturn está ocupada, falla pronto y el despliegue
-- se reintenta, en vez de dejar esperando a las cajas.
SET LOCAL lock_timeout = '5s';

CREATE UNIQUE INDEX IF NOT EXISTS "Sale_branchId_number_key" ON "Sale"("branchId", "number");
CREATE UNIQUE INDEX IF NOT EXISTS "SaleReturn_branchId_number_key" ON "SaleReturn"("branchId", "number");
DROP INDEX IF EXISTS "Sale_number_key";
DROP INDEX IF EXISTS "SaleReturn_number_key";
