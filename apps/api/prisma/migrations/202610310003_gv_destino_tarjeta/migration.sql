-- GV: destino del dinero de tarjeta (área GV, sin cuenta de banco). Columna
-- opcional y aditiva: las filas actuales quedan en nulo.
ALTER TABLE "GvPayment" ADD COLUMN "destination" TEXT;
ALTER TABLE "GvPayment" ADD CONSTRAINT "gv_payment_destination_valid"
  CHECK ("destination" IS NULL OR "destination" = 'gv');
