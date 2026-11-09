-- Medidor de uso y costo de IA. Aditiva; sin datos. Sin llave foránea a propósito:
-- el registro no debe bloquear ni depender de borrar usuarios.
CREATE TABLE IF NOT EXISTS "AiUsage" (
  "id" uuid NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" uuid,
  "branchId" text NOT NULL DEFAULT 'main',
  "feature" text NOT NULL,
  "model" text NOT NULL,
  "inputTokens" integer NOT NULL DEFAULT 0,
  "outputTokens" integer NOT NULL DEFAULT 0,
  "cacheTokens" integer,
  "costUsd" decimal(12,6),
  "ok" boolean NOT NULL DEFAULT true,
  CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AiUsage_branchId_createdAt_idx" ON "AiUsage"("branchId", "createdAt");
