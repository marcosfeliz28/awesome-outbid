-- IA de ventas (T33): sin guardar texto de consultas. Aditiva: no borra tablas.
-- El texto que hubiera en AssistantQuery se vacía; el tope diario pasa a un contador.
ALTER TABLE "AssistantQuery" ALTER COLUMN "question" DROP NOT NULL;
UPDATE "AssistantQuery" SET "question" = NULL WHERE "question" IS NOT NULL;
CREATE TABLE IF NOT EXISTS "AssistantUsage" (
  "userId" uuid NOT NULL,
  "day" text NOT NULL,
  "count" integer NOT NULL DEFAULT 0,
  "inputTokens" integer NOT NULL DEFAULT 0,
  "outputTokens" integer NOT NULL DEFAULT 0,
  "costUsd" decimal(10,6) NOT NULL DEFAULT 0,
  "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantUsage_pkey" PRIMARY KEY ("userId", "day")
);
