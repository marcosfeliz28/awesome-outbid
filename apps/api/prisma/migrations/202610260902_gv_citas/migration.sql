-- Aditiva (dueña, 25-oct, docs/coordinacion/MODULO-GV.md §3-§5): citas de
-- maquillaje e interesadas de GV Makeup Studio. No toca tablas de Macgen.
CREATE TABLE IF NOT EXISTS "GvAppointment" (
    "id" UUID NOT NULL,
    "branchId" TEXT NOT NULL DEFAULT 'main',
    "date" TIMESTAMPTZ(3) NOT NULL,
    "clientName" TEXT NOT NULL,
    "phone" TEXT,
    "instagram" TEXT,
    "service" TEXT NOT NULL,
    "artists" TEXT[],
    "afterHours" BOOLEAN NOT NULL DEFAULT false,
    "total" DECIMAL(14,2) NOT NULL,
    "tip" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'agendada',
    "note" TEXT,
    "weddingQuote" DECIMAL(14,2),
    "venue" TEXT,
    "people" INTEGER,
    "externalId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GvAppointment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT gv_appointment_service_valid CHECK ("service" IN ('sencillo','social','glam','correctivo','novia','con_peinado','boda','otro')),
    CONSTRAINT gv_appointment_status_valid CHECK ("status" IN ('agendada','realizada','cancelada','reembolsada')),
    CONSTRAINT gv_appointment_money_valid CHECK ("total" >= 0 AND "tip" >= 0 AND ("weddingQuote" IS NULL OR "weddingQuote" >= 0) AND ("people" IS NULL OR "people" > 0))
);
CREATE UNIQUE INDEX IF NOT EXISTS "GvAppointment_branchId_externalId_key" ON "GvAppointment"("branchId", "externalId");
CREATE INDEX IF NOT EXISTS "GvAppointment_branchId_date_idx" ON "GvAppointment"("branchId", "date");

CREATE TABLE IF NOT EXISTS "GvLead" (
    "id" UUID NOT NULL,
    "branchId" TEXT NOT NULL DEFAULT 'main',
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "interest" TEXT,
    "action" TEXT,
    "status" TEXT NOT NULL DEFAULT 'por_contactar',
    "note" TEXT,
    "externalId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GvLead_pkey" PRIMARY KEY ("id"),
    CONSTRAINT gv_lead_status_valid CHECK ("status" IN ('por_contactar','contactada','inscrita','descartada'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "GvLead_branchId_externalId_key" ON "GvLead"("branchId", "externalId");
CREATE INDEX IF NOT EXISTS "GvLead_branchId_status_idx" ON "GvLead"("branchId", "status");

-- Los pagos de una cita reutilizan GvPayment (202610260901_gv). Cada pago es
-- de una inscripción o de una cita, nunca de las dos ni de ninguna.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GvPayment_appointmentId_fkey') THEN
    ALTER TABLE "GvPayment" ADD CONSTRAINT "GvPayment_appointmentId_fkey"
      FOREIGN KEY ("appointmentId") REFERENCES "GvAppointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gv_payment_one_owner') THEN
    ALTER TABLE "GvPayment" ADD CONSTRAINT gv_payment_one_owner
      CHECK (num_nonnulls("enrollmentId", "appointmentId") = 1);
  END IF;
END $$;
