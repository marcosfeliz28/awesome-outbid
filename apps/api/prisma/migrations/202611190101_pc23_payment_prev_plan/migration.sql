-- H1 (19-nov): el operador puede cobrar a una empresa en «trial» eligiendo el
-- plan; el pago guarda el plan anterior para que la anulación lo devuelva.
-- Aditiva: columna nula (ADD COLUMN no dispara el trigger de inmutabilidad).
ALTER TABLE "PlatformPayment" ADD COLUMN IF NOT EXISTS "prevPlan" text;
