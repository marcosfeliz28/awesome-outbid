-- G15: nombre de la promoción automática aplicada a cada línea de la venta,
-- para que el ticket y el recibo digan qué promoción explica el descuento.
-- Copia del nombre en el momento de vender (la promoción puede cambiar o
-- borrarse después). NULL = la línea no tuvo promoción automática.
--
-- Idempotente: IF NOT EXISTS no falla si la columna ya existe. Añadir una
-- columna que admite NULL y sin valor por defecto no reescribe la tabla.
ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "promotionName" TEXT;
