-- K2 · La base impone que un SKU y un código de barras sean de una sola
-- variante sin distinguir mayúsculas ni espacios laterales. Hasta ahora sólo lo
-- revisaba la aplicación (assertCodesFree, R9-codigos); los índices
-- "Variant_sku_key" y "Variant_barcode_key" distinguen mayúsculas, así que una
-- escritura que no pasara por esa revisión podía guardar «ABC» y «abc».
--
-- Alcance: los dos índices son GLOBALES (no por "branchId") porque así es la
-- unicidad real de "Variant": "Variant_sku_key" y "Variant_barcode_key" ya son
-- globales y la API rechaza un código de otra sucursal («ya se usa en otra
-- sucursal»). Un índice global también garantiza la unicidad dentro de cada
-- sucursal. El cruce entre campos (SKU de una variante = barras de otra) no se
-- puede expresar con un índice único y sigue a cargo de assertCodesFree.
--
-- Nunca hace fallar un despliegue: si ya hay datos repetidos, avisa con NOTICE
-- (cuántas claves y ejemplos), deja una entrada en "AuditLog" (acción
-- k2_code_index_skipped, en cada sucursal afectada) y NO crea ese índice.
-- Para saber si quedó omitido:
--   SELECT indexname FROM pg_indexes WHERE indexname LIKE 'Variant_%_ci_key';
-- Para crearlo después,
-- corrige los códigos en Productos y vuelve a ejecutar este archivo:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f migration.sql
-- Es idempotente: un índice que ya existe no se toca.
--
-- Prisma no representa índices de expresión: están documentados como
-- comentario en schema.prisma (modelo Variant) y viven sólo aquí.
DO $$
DECLARE
  spec record;
  duplicate_keys integer;
  duplicate_rows integer;
  examples text;
BEGIN
  -- Entre la revisión de duplicados y CREATE INDEX nadie puede escribir en
  -- "Variant" (SHARE bloquea INSERT/UPDATE/DELETE, no las lecturas). Así la
  -- revisión no queda vieja y CREATE UNIQUE INDEX no falla a medio despliegue.
  LOCK TABLE "Variant" IN SHARE MODE;

  FOR spec IN
    SELECT * FROM (VALUES
      ('Variant_sku_ci_key', 'sku', 'SKU'),
      ('Variant_barcode_ci_key', 'barcode', 'código de barras')
    ) AS s(index_name, column_name, label)
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE c.relname = spec.index_name
         AND c.relkind = 'i'
         AND n.nspname = current_schema()
    ) THEN
      RAISE NOTICE 'K2: el índice % ya existe; no se cambia.', spec.index_name;
      CONTINUE;
    END IF;

    -- Misma clave que el índice: lower(btrim(...)); NULL y vacíos no cuentan.
    EXECUTE format(
      'SELECT count(*)::int, coalesce(sum(n), 0)::int,
              string_agg(quote_literal(k) || '' ('' || n || '' variantes)'', '', '' ORDER BY k)
                FILTER (WHERE rn <= 10)
         FROM (SELECT lower(btrim(%1$I)) AS k, count(*) AS n,
                      row_number() OVER (ORDER BY lower(btrim(%1$I))) AS rn
                 FROM "Variant"
                WHERE %1$I IS NOT NULL AND btrim(%1$I) <> ''''
                GROUP BY 1
               HAVING count(*) > 1) d',
      spec.column_name)
      INTO duplicate_keys, duplicate_rows, examples;

    IF duplicate_keys > 0 THEN
      -- Registro duradero (Prisma no muestra los NOTICE al desplegar): una
      -- entrada de auditoría en cada sucursal con variantes repetidas.
      EXECUTE format(
        'INSERT INTO "AuditLog" (id, "userId", action, entity, "entityId", after, "branchId")
         SELECT gen_random_uuid(), ''system'', ''k2_code_index_skipped'', ''Variant'', $1,
                jsonb_build_object(''index'', $1, ''field'', $2, ''duplicateKeys'', $3,
                                   ''duplicateRows'', $4, ''examples'', $5),
                b."branchId"
           FROM (SELECT DISTINCT v."branchId" FROM "Variant" v
                  WHERE v.%1$I IS NOT NULL AND btrim(v.%1$I) <> ''''
                    AND lower(btrim(v.%1$I)) IN (
                      SELECT lower(btrim(%1$I)) FROM "Variant"
                       WHERE %1$I IS NOT NULL AND btrim(%1$I) <> ''''
                       GROUP BY 1 HAVING count(*) > 1)) b',
        spec.column_name)
        USING spec.index_name, spec.column_name, duplicate_keys, duplicate_rows, examples;
      RAISE NOTICE 'K2: NO se creó el índice %: hay % % repetido(s) sin distinguir mayúsculas ni espacios en % variantes. Ejemplos: %. Corrige esos códigos en Productos y vuelve a ejecutar esta migración con psql.',
        spec.index_name, duplicate_keys, spec.label, duplicate_rows, examples;
      CONTINUE;
    END IF;

    BEGIN
      -- Índice parcial: un SKU o código de barras NULL o vacío no reserva nada.
      EXECUTE format(
        'CREATE UNIQUE INDEX %I ON "Variant" (lower(btrim(%I))) WHERE %I IS NOT NULL AND btrim(%I) <> ''''',
        spec.index_name, spec.column_name, spec.column_name, spec.column_name);
      RAISE NOTICE 'K2: índice % creado.', spec.index_name;
    EXCEPTION WHEN unique_violation THEN
      -- No debería ocurrir con el bloqueo de arriba; si ocurre, se avisa y el
      -- despliegue sigue sin el índice, igual que con duplicados detectados.
      RAISE NOTICE 'K2: NO se creó el índice % (%): hay % repetidos. Corrígelos y vuelve a ejecutar esta migración con psql.',
        spec.index_name, SQLERRM, spec.label;
    END;
  END LOOP;
END $$;
