-- Módulo GV Makeup Studio (dueña, 25-oct; docs/coordinacion/MODULO-GV.md).
-- Aditiva: sólo tablas nuevas, el rol «gv» y los permisos gv:* para gerencia.
-- No toca ventas, caja ni comprobantes de Macgen. Idempotente.

CREATE TABLE IF NOT EXISTS "GvCourse" (
    "id" UUID NOT NULL,
    "branchId" TEXT NOT NULL DEFAULT 'main',
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GvCourse_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "gv_course_type_valid" CHECK ("type" IN ('automaquillaje', 'brazilian', 'personalizado', 'otro')),
    CONSTRAINT "gv_course_price_nonnegative" CHECK ("price" >= 0),
    CONSTRAINT "gv_course_capacity_nonnegative" CHECK ("capacity" >= 0)
);

CREATE TABLE IF NOT EXISTS "GvEnrollment" (
    "id" UUID NOT NULL,
    "branchId" TEXT NOT NULL DEFAULT 'main',
    "externalId" TEXT,
    "operationId" UUID,
    "courseId" UUID NOT NULL,
    "clientName" TEXT NOT NULL,
    "phone" TEXT,
    "instagram" TEXT,
    "agreedPrice" DECIMAL(14,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'activa',
    "attended" BOOLEAN,
    "boughtBrushSet" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GvEnrollment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GvEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "GvCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "gv_enrollment_status_valid" CHECK ("status" IN ('activa', 'no_asistio', 'personalizado', 'cancelada', 'reembolsada')),
    CONSTRAINT "gv_enrollment_price_nonnegative" CHECK ("agreedPrice" >= 0)
);

CREATE TABLE IF NOT EXISTS "GvPayment" (
    "id" UUID NOT NULL,
    "branchId" TEXT NOT NULL DEFAULT 'main',
    "externalId" TEXT,
    "operationId" UUID,
    "enrollmentId" UUID,
    -- Cita de maquillaje (módulo de citas, migración aparte; sin FK por ahora).
    "appointmentId" UUID,
    "date" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "concept" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "bank" TEXT,
    "reference" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectReason" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GvPayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GvPayment_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "GvEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "gv_payment_amount_positive" CHECK ("amount" > 0),
    CONSTRAINT "gv_payment_concept_valid" CHECK ("concept" IN ('separo', 'restante', 'segundo', 'tercero', 'otro')),
    CONSTRAINT "gv_payment_method_valid" CHECK ("method" IN ('efectivo', 'transferencia', 'tarjeta'))
);

CREATE INDEX IF NOT EXISTS "GvCourse_branchId_date_idx" ON "GvCourse"("branchId", "date");
CREATE UNIQUE INDEX IF NOT EXISTS "GvCourse_branchId_externalId_key" ON "GvCourse"("branchId", "externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "GvEnrollment_operationId_key" ON "GvEnrollment"("operationId");
CREATE INDEX IF NOT EXISTS "GvEnrollment_courseId_idx" ON "GvEnrollment"("courseId");
CREATE UNIQUE INDEX IF NOT EXISTS "GvEnrollment_branchId_externalId_key" ON "GvEnrollment"("branchId", "externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "GvPayment_operationId_key" ON "GvPayment"("operationId");
CREATE INDEX IF NOT EXISTS "GvPayment_enrollmentId_idx" ON "GvPayment"("enrollmentId");
CREATE INDEX IF NOT EXISTS "GvPayment_appointmentId_idx" ON "GvPayment"("appointmentId");
CREATE INDEX IF NOT EXISTS "GvPayment_branchId_date_idx" ON "GvPayment"("branchId", "date");
CREATE UNIQUE INDEX IF NOT EXISTS "GvPayment_branchId_externalId_key" ON "GvPayment"("branchId", "externalId");

-- Rol de la empleada de GV. No se asigna a nadie aquí.
INSERT INTO "Role" ("id", "name", "permissions", "updatedAt")
VALUES (gen_random_uuid(), 'gv', ARRAY['gv:read', 'gv:write', 'gv:reports'], CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- La gerencia también lleva GV (el administrador ya tiene «*»).
UPDATE "Role"
SET "permissions" = "permissions" || ARRAY(
      SELECT p FROM unnest(ARRAY['gv:read', 'gv:write', 'gv:reports']) AS p
      WHERE NOT (p = ANY ("permissions"))),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "name" = 'manager'
  AND NOT ("permissions" @> ARRAY['gv:read', 'gv:write', 'gv:reports']);
