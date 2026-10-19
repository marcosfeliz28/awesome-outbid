-- Repair the retention prerequisites even if the earlier privacy migration
-- was marked applied after catching a lock/DDL error.
-- Unlike that migration, this one must fail loudly so Prisma leaves it
-- pending and a later deploy can retry it.
SET lock_timeout = '15s';

ALTER TABLE "AuthAttempt"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- A partially-created nullable column is also repaired without losing rows.
UPDATE "AuthAttempt"
   SET "updatedAt" = CURRENT_TIMESTAMP
 WHERE "updatedAt" IS NULL;
ALTER TABLE "AuthAttempt"
  ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN "updatedAt" SET NOT NULL;

CREATE OR REPLACE FUNCTION nexora_touch_auth_attempt() RETURNS trigger
LANGUAGE plpgsql AS $body$
BEGIN
  NEW."updatedAt" := timezone('UTC', now());
  RETURN NEW;
END
$body$;

-- Recreate even if a partial prior attempt left a same-name trigger with the
-- wrong timing, events, or function.
DROP TRIGGER IF EXISTS auth_attempt_touch ON "AuthAttempt";
CREATE TRIGGER auth_attempt_touch
  BEFORE INSERT OR UPDATE ON "AuthAttempt"
  FOR EACH ROW EXECUTE FUNCTION nexora_touch_auth_attempt();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'AuthAttempt'
       AND column_name = 'updatedAt'
       AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'AuthAttempt.updatedAt is missing or nullable after repair';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_proc p ON p.oid = t.tgfoid
      JOIN pg_namespace pn ON pn.oid = p.pronamespace
     WHERE n.nspname = current_schema()
       AND c.relname = 'AuthAttempt'
       AND t.tgname = 'auth_attempt_touch'
       AND NOT t.tgisinternal
       AND t.tgtype = 23
       AND p.proname = 'nexora_touch_auth_attempt'
       AND pn.nspname = current_schema()
  ) THEN
    RAISE EXCEPTION 'AuthAttempt.updatedAt trigger is missing after repair';
  END IF;
END $$;
