-- Auditorías 03 (A2, M11, B1) y 06 (D-A2, D-B12): retención y copias de
-- fotos.
--
-- 1. AuthAttempt."updatedAt": la tabla no tenía fecha, así que las filas de
--    usuarios inexistentes (`login:missing:%`, con la IP en la clave) no se
--    podían purgar. La fecha la mantiene un disparador en cada INSERT/UPDATE
--    (también los UPDATE crudos de security.ts), en UTC como el resto de la
--    base. La purga la hace apps/api/src/retention.ts.
-- 2. AuditLog: «verificar» y «rechazar» un abono guardaban la fila Payment
--    completa en before, con la foto del comprobante (data URL base64 de
--    hasta 2,7 MB) que la anonimización no borraba. Se reemplaza por
--    "(imagen)" en las filas existentes; las nuevas ya llegan sin la foto
--    (audit() en common.ts).
--
-- Nunca aborta un despliegue (cada paso con su manejo de errores y RAISE
-- NOTICE) y es idempotente: puede volver a ejecutarse con psql.

DO $$
BEGIN
  PERFORM set_config('lock_timeout', '15s', true);
  ALTER TABLE "AuthAttempt"
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'DATOS: no se agregó AuthAttempt.updatedAt (%); el despliegue sigue.', SQLERRM;
END $$;

DO $$
BEGIN
  PERFORM set_config('lock_timeout', '15s', true);
  EXECUTE $fn$
    CREATE OR REPLACE FUNCTION nexora_touch_auth_attempt() RETURNS trigger
    LANGUAGE plpgsql AS $body$
    BEGIN
      NEW."updatedAt" := timezone('UTC', now());
      RETURN NEW;
    END $body$
  $fn$;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'AuthAttempt' AND column_name = 'updatedAt'
  ) AND NOT EXISTS (
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
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'DATOS: no se creó el disparador de AuthAttempt (%); el despliegue sigue.', SQLERRM;
END $$;

DO $$
DECLARE
  cleaned BIGINT := 0;
  step BIGINT;
BEGIN
  PERFORM set_config('lock_timeout', '15s', true);
  UPDATE "AuditLog"
     SET "before" = jsonb_set("before", '{proofUrl}', '"(imagen)"'::jsonb)
   WHERE jsonb_typeof("before") = 'object'
     AND "before"->>'proofUrl' LIKE 'data:%';
  GET DIAGNOSTICS step = ROW_COUNT;
  cleaned := cleaned + step;
  UPDATE "AuditLog"
     SET "after" = jsonb_set("after", '{proofUrl}', '"(imagen)"'::jsonb)
   WHERE jsonb_typeof("after") = 'object'
     AND "after"->>'proofUrl' LIKE 'data:%';
  GET DIAGNOSTICS step = ROW_COUNT;
  cleaned := cleaned + step;
  IF cleaned > 0 THEN
    RAISE NOTICE 'DATOS: se quitaron % copias de fotos de comprobantes de la bitácora.', cleaned;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'DATOS: no se limpiaron las fotos de la bitácora (%); el despliegue sigue.', SQLERRM;
END $$;
