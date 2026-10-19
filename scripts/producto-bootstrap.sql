-- Ejecutar UNA vez como administrador de nexora-saas-db, nunca en la tienda.
-- El nombre nexora_saas_migrator coincide con render.producto.yaml.
-- No contiene contraseñas ni crea usuarios con LOGIN.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexora_tenant_runtime') THEN
    CREATE ROLE nexora_tenant_runtime NOLOGIN;
  END IF;
END $$;
GRANT nexora_tenant_runtime TO nexora_saas_migrator WITH ADMIN OPTION;

-- Salida esperada: una fila con rol nexora_tenant_runtime y miembro migrador.
SELECT r.rolname AS runtime_role, m.rolname AS migrator
FROM pg_auth_members g
JOIN pg_roles r ON r.oid = g.roleid
JOIN pg_roles m ON m.oid = g.member
WHERE r.rolname = 'nexora_tenant_runtime'
  AND m.rolname = 'nexora_saas_migrator';
