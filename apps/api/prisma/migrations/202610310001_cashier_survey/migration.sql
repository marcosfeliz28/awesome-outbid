-- Encuesta de la caja: una respuesta editable por persona. Aditiva; sin datos.
CREATE TABLE IF NOT EXISTS "CashierSurvey" (
  "id" uuid NOT NULL,
  "userId" uuid NOT NULL,
  "branchId" text NOT NULL DEFAULT 'main',
  "answers" jsonb NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL,
  CONSTRAINT "CashierSurvey_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CashierSurvey_userId_key" ON "CashierSurvey"("userId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CashierSurvey_userId_fkey'
                 AND conrelid = '"CashierSurvey"'::regclass) THEN
    ALTER TABLE "CashierSurvey" ADD CONSTRAINT "CashierSurvey_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
