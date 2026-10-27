-- Revisión 25-oct #10: una venta nueva sin envío no lleva mensajero. Sólo se
-- quita el valor por defecto («Addison»); las ventas guardadas no se tocan
-- (limpiarlas lo decide la dueña). Idempotente: repetirla no falla.
ALTER TABLE "Sale" ALTER COLUMN "courierName" DROP DEFAULT;
