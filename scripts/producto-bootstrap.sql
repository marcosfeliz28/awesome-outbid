-- Corre en cada preDeployCommand de render.producto.yaml, antes de migrar,
-- como nexora_saas_migrator (dueño de nexora-saas-db). Idempotente. Nunca en la tienda.
-- No contiene contraseñas ni crea usuarios con LOGIN.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexora_tenant_runtime') THEN
    CREATE ROLE nexora_tenant_runtime NOLOGIN;
  END IF;
END $$;
-- Sin WITH ADMIN OPTION: en PG16+ un dueño con CREATEROLE (no superusuario) ya
-- recibe ADMIN al crear el rol, pero sin SET; este GRANT le da SET (SET LOCAL ROLE).
GRANT nexora_tenant_runtime TO nexora_saas_migrator;

-- Falla el despliegue si el rol tiene LOGIN o el migrador no puede asumirlo.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'nexora_tenant_runtime' AND NOT rolcanlogin
      AND pg_has_role('nexora_saas_migrator', oid, 'SET')
  ) THEN
    RAISE EXCEPTION 'nexora_tenant_runtime ausente, con LOGIN o sin SET para nexora_saas_migrator';
  END IF;
END $$;
