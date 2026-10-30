-- IA de ventas (solo lectura): tabla nueva; no toca ningún dato existente.
CREATE TABLE "AssistantQuery" (
  "id" UUID NOT NULL,
  "userId" TEXT NOT NULL,
  "day" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "tools" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "tokens" INTEGER NOT NULL DEFAULT 0,
  "ok" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssistantQuery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AssistantQuery_userId_day_idx" ON "AssistantQuery"("userId", "day");
