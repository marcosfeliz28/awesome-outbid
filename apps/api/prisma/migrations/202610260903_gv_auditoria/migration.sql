-- Correcciones de la auditoría GV (docs/coordinacion/AUDITORIA_GV_CHATGPT.md).
-- Aditiva e idempotente; sólo toca tablas GV y los roles gv y manager.

-- GV-13: reembolso registrado (monto y fecha) en inscripciones y citas.
ALTER TABLE "GvEnrollment" ADD COLUMN IF NOT EXISTS "refundAmount" DECIMAL(14,2);
ALTER TABLE "GvEnrollment" ADD COLUMN IF NOT EXISTS "refundDate" DATE;
ALTER TABLE "GvAppointment" ADD COLUMN IF NOT EXISTS "refundAmount" DECIMAL(14,2);
ALTER TABLE "GvAppointment" ADD COLUMN IF NOT EXISTS "refundDate" DATE;

-- Restricciones NOT VALID: rigen para toda fila nueva o modificada desde ya;
-- las filas anteriores se validan aparte y, si alguna no cumple (datos de la
-- versión anterior de GV), la migración avisa con NOTICE y no aborta el
-- despliegue. Las filas que no cumplen se ven con la consulta del aviso.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gv_enrollment_refund_valid') THEN
    ALTER TABLE "GvEnrollment" ADD CONSTRAINT gv_enrollment_refund_valid
      CHECK (("refundAmount" IS NULL AND "refundDate" IS NULL)
          OR ("status" = 'reembolsada' AND "refundAmount" > 0 AND "refundDate" IS NOT NULL)) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gv_appointment_refund_valid') THEN
    ALTER TABLE "GvAppointment" ADD CONSTRAINT gv_appointment_refund_valid
      CHECK (("refundAmount" IS NULL AND "refundDate" IS NULL)
          OR ("status" = 'reembolsada' AND "refundAmount" > 0 AND "refundDate" IS NOT NULL)) NOT VALID;
  END IF;
  -- GV-06: un pago no puede estar verificado y rechazado a la vez.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gv_payment_review_exclusive') THEN
    ALTER TABLE "GvPayment" ADD CONSTRAINT gv_payment_review_exclusive
      CHECK (NOT ("verified" AND "rejectedAt" IS NOT NULL)) NOT VALID;
  END IF;
  -- GV-07: transferencia con banco y referencia.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gv_payment_transfer_details') THEN
    ALTER TABLE "GvPayment" ADD CONSTRAINT gv_payment_transfer_details
      CHECK ("method" <> 'transferencia' OR ("bank" IS NOT NULL AND "reference" IS NOT NULL)) NOT VALID;
  END IF;
END $$;

DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN SELECT conrelid::regclass::text AS tbl, conname FROM pg_constraint
           WHERE conname IN ('gv_enrollment_refund_valid', 'gv_appointment_refund_valid',
                             'gv_payment_review_exclusive', 'gv_payment_transfer_details')
             AND NOT convalidated
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', c.tbl, c.conname);
    EXCEPTION WHEN check_violation THEN
      RAISE NOTICE 'GV: % tiene filas anteriores que no cumplen %; queda NOT VALID (las filas nuevas sí se exigen). Corrígelas y ejecuta ALTER TABLE % VALIDATE CONSTRAINT %.', c.tbl, c.conname, c.tbl, c.conname;
    END;
  END LOOP;
END $$;

-- GV-04: el rol reservado «gv» tiene exactamente estos permisos, aunque ya
-- existiera con otros.
UPDATE "Role"
SET "permissions" = ARRAY['gv:read', 'gv:write', 'gv:reports'],
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'gv'
  AND "permissions" IS DISTINCT FROM ARRAY['gv:read', 'gv:write', 'gv:reports'];

-- GV-05: la gerencia verifica transferencias de GV (gv:verify); el rol gv no.
UPDATE "Role"
SET "permissions" = "permissions" || ARRAY['gv:verify'],
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'manager'
  AND NOT ('gv:verify' = ANY ("permissions"));
