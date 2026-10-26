-- Correcciones de la auditoría GV (docs/coordinacion/AUDITORIA_GV_CHATGPT.md).
-- Aditiva e idempotente; sólo toca tablas GV y los roles gv y manager.

-- GV-13: reembolso registrado (monto y fecha) en inscripciones y citas.
ALTER TABLE "GvEnrollment" ADD COLUMN IF NOT EXISTS "refundAmount" DECIMAL(14,2);
ALTER TABLE "GvEnrollment" ADD COLUMN IF NOT EXISTS "refundDate" DATE;
ALTER TABLE "GvAppointment" ADD COLUMN IF NOT EXISTS "refundAmount" DECIMAL(14,2);
ALTER TABLE "GvAppointment" ADD COLUMN IF NOT EXISTS "refundDate" DATE;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gv_enrollment_refund_valid') THEN
    ALTER TABLE "GvEnrollment" ADD CONSTRAINT gv_enrollment_refund_valid
      CHECK (("refundAmount" IS NULL AND "refundDate" IS NULL)
          OR ("status" = 'reembolsada' AND "refundAmount" > 0 AND "refundDate" IS NOT NULL));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gv_appointment_refund_valid') THEN
    ALTER TABLE "GvAppointment" ADD CONSTRAINT gv_appointment_refund_valid
      CHECK (("refundAmount" IS NULL AND "refundDate" IS NULL)
          OR ("status" = 'reembolsada' AND "refundAmount" > 0 AND "refundDate" IS NOT NULL));
  END IF;
  -- GV-06: un pago no puede estar verificado y rechazado a la vez.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gv_payment_review_exclusive') THEN
    ALTER TABLE "GvPayment" ADD CONSTRAINT gv_payment_review_exclusive
      CHECK (NOT ("verified" AND "rejectedAt" IS NOT NULL));
  END IF;
  -- GV-07: transferencia con banco y referencia.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gv_payment_transfer_details') THEN
    ALTER TABLE "GvPayment" ADD CONSTRAINT gv_payment_transfer_details
      CHECK ("method" <> 'transferencia' OR ("bank" IS NOT NULL AND "reference" IS NOT NULL));
  END IF;
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
