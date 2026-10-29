-- GV: nuevo concepto de pago «completo» (pago de una sola vez). Solo amplía la
-- regla: todas las filas actuales siguen cumpliéndola.
ALTER TABLE "GvPayment" DROP CONSTRAINT IF EXISTS "gv_payment_concept_valid";
ALTER TABLE "GvPayment" ADD CONSTRAINT "gv_payment_concept_valid"
  CHECK ("concept" IN ('separo', 'completo', 'restante', 'segundo', 'tercero', 'otro'));
