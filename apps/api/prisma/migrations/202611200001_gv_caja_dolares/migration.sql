-- Decisión 2 (20-nov-2026): la caja de GV cuenta los dólares aparte, como la
-- caja principal (CashSession.closeDetails). Una columna JSON opcional para
-- guardar esperado, contado y diferencia en US$ del cierre. Solo agrega: no
-- toca filas ni cierres anteriores (sin valor = cierre de antes, US$ en pesos).
ALTER TABLE "GvCashSession" ADD COLUMN "closeDetails" JSONB;
