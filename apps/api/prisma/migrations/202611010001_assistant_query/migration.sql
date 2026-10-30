-- IA de ventas (T33): registro de preguntas. Aditiva; no toca datos existentes.
CREATE TABLE IF NOT EXISTS "AssistantQuery" (
  "id" uuid NOT NULL,
  "userId" uuid NOT NULL,
  "branchId" text NOT NULL DEFAULT 'main',
  "question" text NOT NULL,
  "model" text NOT NULL,
  "inputTokens" integer NOT NULL DEFAULT 0,
  "outputTokens" integer NOT NULL DEFAULT 0,
  "costUsd" decimal(10,6) NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'ok',
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantQuery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AssistantQuery_userId_createdAt_idx" ON "AssistantQuery"("userId", "createdAt");
