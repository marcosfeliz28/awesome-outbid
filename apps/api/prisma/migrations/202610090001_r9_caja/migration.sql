-- Ronda 9 · revisión · caja (R9-caja-4): la venta en espera o cotización
-- guarda el descuento global del carrito para devolverlo al recuperarla.
-- Las ventas en espera anteriores quedan sin descuento global (0), como se
-- recuperaban hasta ahora. Re-ejecutable: IF NOT EXISTS.
ALTER TABLE "Quote" ADD COLUMN IF NOT EXISTS "globalDiscount" DECIMAL(5,2) NOT NULL DEFAULT 0;
