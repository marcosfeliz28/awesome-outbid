-- R9-A05 (auditoría de ChatGPT a la ronda 9): una devolución que no vuelve al
-- stock vendible (dañada, abierta) deja constancia de la cantidad física
-- recibida y de su costo, aparte del costo contable (que sigue en cero para
-- no descontar la utilidad dos veces). Las devoluciones anteriores quedan en 0.
ALTER TABLE "SaleReturn" ADD COLUMN IF NOT EXISTS "wasteQty" DECIMAL(14,3) NOT NULL DEFAULT 0;
ALTER TABLE "SaleReturn" ADD COLUMN IF NOT EXISTS "wasteCostTotal" DECIMAL(14,2) NOT NULL DEFAULT 0;
