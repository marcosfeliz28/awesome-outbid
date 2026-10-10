-- Auditoría 04 v2 (N1, N2, N3) y 06 v2 (N-M2): valida, sin bloquear la tienda,
-- las restricciones que quedaron NOT VALID en 202610210002_datos_restricciones
-- (y en cualquier otra migración) cuando sus filas ya cumplen.
--
-- Por qué una migración nueva: 202610210002 ya está aplicada en producción y
-- editar una migración aplicada cambia su suma de verificación (P3006/deriva).
--
-- Cómo, sin esperar ni abortar:
--   * VALIDATE CONSTRAINT toma SHARE UPDATE EXCLUSIVE sobre la tabla (y ROW
--     SHARE sobre la referida en una FK): NO bloquea lecturas ni escrituras
--     (SELECT/INSERT/UPDATE/DELETE), sólo otra migración o un VACUUM. Es
--     distinto de ADD CONSTRAINT, que sí toma SHARE ROW EXCLUSIVE.
--   * lock_timeout de 3 s (por debajo de los 5 s del envoltorio de despliegue
--     y de los 15 s de las migraciones anteriores): si una escritura larga
--     retiene la tabla, esa restricción se omite en vez de encolar nada.
--   * Una restricción por sentencia, cada una con su propia captura
--     (subtransacción): un fallo en una no afecta a las demás ni al despliegue.
--   * El resultado NO se pierde en un NOTICE que Prisma no muestra: cada
--     restricción que queda sin validar deja una fila en "AuditLog" con
--     action = 'constraint_not_validated', entity = 'Constraint', entityId =
--     nombre y, en "after", la tabla, el motivo (violations | lock_timeout |
--     error), la cantidad de filas que la violan, su definición y la consulta
--     para listarlas. post-deploy-check.mjs avisa mientras haya alguna.
--   * Una restricción NOT VALID cuyas filas violan la regla sigue protegiendo
--     lo nuevo; no se toca ni se borra ninguna fila. Para corregir las filas
--     y validarla después: docs/MIGRACIONES_SEGURAS.md (consulta de
--     violaciones) y volver a ejecutar este archivo con psql (es idempotente).
--
-- El DO es una sola sentencia: el statement_timeout de 120 s del envoltorio la
-- cubre completa (las tablas de una tienda se recorren en milisegundos) y
-- QUERY_CANCELED no se puede capturar con OTHERS. Desplegar fuera de horario.

DO $$
DECLARE
  spec RECORD;
  violating BIGINT;
  reason TEXT;
  detail TEXT;
  query TEXT;
  not_validated INT := 0;
  validated_now INT := 0;
BEGIN
  PERFORM set_config('lock_timeout', '3s', true);
  FOR spec IN
    SELECT con.oid AS con_oid,
           con.conname AS name,
           con.contype AS kind,
           rel.relname AS table_name,
           pg_get_constraintdef(con.oid) AS definition,
           (SELECT a.attname FROM pg_attribute a
             WHERE a.attrelid = con.conrelid AND a.attnum = con.conkey[1]) AS column_name,
           (SELECT r2.relname FROM pg_class r2 WHERE r2.oid = con.confrelid) AS ref_table,
           (SELECT a2.attname FROM pg_attribute a2
             WHERE a2.attrelid = con.confrelid AND a2.attnum = con.confkey[1]) AS ref_column
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
     WHERE n.nspname = current_schema()
       AND NOT con.convalidated
       AND con.contype IN ('c', 'f')
     ORDER BY rel.relname, con.conname
  LOOP
    reason := NULL;
    violating := NULL;
    detail := NULL;
    query := NULL;
    BEGIN
      EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', spec.table_name, spec.name);
      validated_now := validated_now + 1;
      RAISE NOTICE 'VALIDAR: % validada.', spec.name;
    EXCEPTION
      WHEN check_violation OR foreign_key_violation THEN
        reason := 'violations';
        detail := SQLERRM;
      WHEN lock_not_available THEN
        reason := 'lock_timeout';
        detail := SQLERRM;
      WHEN OTHERS THEN
        reason := 'error';
        detail := SQLSTATE || ': ' || SQLERRM;
    END;

    IF reason IS NULL THEN
      CONTINUE;
    END IF;

    -- Cuántas filas violan la regla y cómo listarlas (una FK de una columna o
    -- un CHECK). Si no se puede calcular, el motivo basta.
    IF reason = 'violations' THEN
      BEGIN
        IF spec.kind = 'f' AND spec.column_name IS NOT NULL THEN
          query := format(
            'SELECT c.* FROM %1$I c WHERE c.%2$I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM %3$I r WHERE r.%4$I = c.%2$I)',
            spec.table_name, spec.column_name, spec.ref_table, spec.ref_column);
          EXECUTE 'SELECT count(*) FROM (' || query || ') v' INTO violating;
        ELSIF spec.kind = 'c' THEN
          query := format(
            'SELECT * FROM %I WHERE NOT %s',
            spec.table_name,
            regexp_replace(regexp_replace(spec.definition, '^CHECK ', ''), ' NOT VALID$', ''));
          EXECUTE 'SELECT count(*) FROM (' || query || ') v' INTO violating;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        violating := NULL;
      END;
    END IF;

    not_validated := not_validated + 1;
    BEGIN
      INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", after, "branchId")
      VALUES (
        gen_random_uuid(), 'system', 'constraint_not_validated', 'Constraint', spec.name,
        jsonb_build_object(
          'table', spec.table_name,
          'reason', reason,
          'violatingRows', violating,
          'definition', spec.definition,
          'listQuery', query,
          'detail', left(detail, 300)),
        coalesce((SELECT s.id FROM "Settings" s ORDER BY s.id LIMIT 1), 'main'));
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'VALIDAR: no se pudo registrar % en AuditLog (%).', spec.name, SQLERRM;
    END;
    RAISE NOTICE 'VALIDAR: % sigue NOT VALID en "%" (%, filas que la violan: %).',
      spec.name, spec.table_name, reason, coalesce(violating::text, 'n/d');
  END LOOP;
  RAISE NOTICE 'VALIDAR: % restricción(es) validada(s) ahora, % sin validar (ver AuditLog constraint_not_validated).',
    validated_now, not_validated;
END $$;
