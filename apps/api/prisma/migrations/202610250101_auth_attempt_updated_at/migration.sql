-- Auditoría completa D-01: 202610210003_datos_privacidad podía saltarse
-- AuthAttempt."updatedAt" y su disparador con solo un NOTICE, y retention.ts
-- depende de ambos. Aquí se aseguran (idempotente) y, si algo falla, la
-- migración falla en voz alta.
ALTER TABLE "AuthAttempt"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE OR REPLACE FUNCTION nexora_touch_auth_attempt() RETURNS trigger
LANGUAGE plpgsql AS $body$
BEGIN
  NEW."updatedAt" := timezone('UTC', now());
  RETURN NEW;
END $body$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = current_schema()
       AND c.relname = 'AuthAttempt'
       AND t.tgname = 'auth_attempt_touch'
  ) THEN
    CREATE TRIGGER auth_attempt_touch
      BEFORE INSERT OR UPDATE ON "AuthAttempt"
      FOR EACH ROW EXECUTE FUNCTION nexora_touch_auth_attempt();
  END IF;
END $$;
