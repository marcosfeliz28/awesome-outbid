-- Baja de cliente (docs/operacion/BAJA_DE_CLIENTE.md). Aditiva; sin datos.
-- Una fila por sucursal dada de baja: fechas y huellas (SHA-256) del paquete
-- exportado y del acta de supresión. Sin datos personales. La supresión la
-- conserva a propósito (es la constancia).
CREATE TABLE IF NOT EXISTS "BranchTermination" (
  "branchId" text NOT NULL,
  "terminatedAt" timestamp(3),
  "exportedAt" timestamp(3),
  "exportSha256" text,
  "suppressedAt" timestamp(3),
  "actaSha256" text,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BranchTermination_pkey" PRIMARY KEY ("branchId")
);
