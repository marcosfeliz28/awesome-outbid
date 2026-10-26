-- IA-08: una referencia de pago acredita un solo paquete de IA en toda la
-- plataforma (todas las empresas pagan a la misma cuenta de Nexora), sin
-- distinguir mayúsculas ni espacios. Aditiva y nunca deja la garantía sin
-- instalar: si ya hay referencias equivalentes, el índice único excluye solo a
-- las repetidas posteriores (se conserva la más antigua de cada grupo), de modo
-- que ninguna fila nueva puede repetir una referencia; el RAISE NOTICE dice
-- cuántas quedaron fuera para que la administración las concilie. La tabla es
-- inmutable, así que no se borra ni se corrige ninguna fila.
-- El índice se crea dentro de la transacción de la migración (CREATE INDEX
-- CONCURRENTLY no es posible en ella): bloquea las escrituras de AiPackCredit,
-- una tabla pequeña que solo escribe el operador, el tiempo de un recorrido.
DO $$
DECLARE
  later TEXT;
  n BIGINT;
  key CONSTANT TEXT := 'lower(regexp_replace(reference, ''[[:space:]]+'', '''', ''g''))';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class
             WHERE relname = 'AiPackCredit_reference_normalized_key'
               AND relnamespace = current_schema()::regnamespace) THEN
    RETURN;
  END IF;
  SELECT string_agg(quote_literal(id::text), ','), count(*) INTO later, n
  FROM (
    SELECT id, row_number() OVER (
      PARTITION BY lower(regexp_replace(reference, '[[:space:]]+', '', 'g'))
      ORDER BY "createdAt", id) AS pos
    FROM "AiPackCredit"
  ) ranked WHERE pos > 1;
  IF n > 0 THEN
    RAISE NOTICE 'AiPackCredit: % referencia(s) repetida(s) quedan fuera del índice (ids: %); concíliala(s).', n, later;
    EXECUTE format('CREATE UNIQUE INDEX "AiPackCredit_reference_normalized_key" ON "AiPackCredit" (%s) WHERE id NOT IN (%s)', key, later);
  ELSE
    EXECUTE format('CREATE UNIQUE INDEX "AiPackCredit_reference_normalized_key" ON "AiPackCredit" (%s)', key);
  END IF;
END $$;
