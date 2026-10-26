-- La guardia de 202610260001 buscaba el padre con `columna::text = $1`: el
-- cast anula el índice y cada fila insertada recorría toda la tabla padre
-- (17 000 variantes ≈ 260 s). Ahora el parámetro se convierte al tipo de la
-- columna padre y la búsqueda usa su índice. Misma semántica y mensaje.
CREATE OR REPLACE FUNCTION nexora_check_tenant_fk() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_tenant uuid; foreign_value text; parent_type text;
BEGIN
 foreign_value := to_jsonb(NEW)->>TG_ARGV[2];
 IF foreign_value IS NULL THEN RETURN NEW; END IF;
 SELECT format_type(a.atttypid, a.atttypmod) INTO STRICT parent_type
   FROM pg_attribute a
  WHERE a.attrelid = quote_ident(TG_ARGV[0])::regclass AND a.attname = TG_ARGV[1];
 EXECUTE format('SELECT "tenantId" FROM %I WHERE %I = $1::%s', TG_ARGV[0], TG_ARGV[1], parent_type)
   INTO parent_tenant USING foreign_value;
 IF parent_tenant IS DISTINCT FROM NEW."tenantId" THEN
  RAISE EXCEPTION 'Referencia a otra empresa o registro inexistente' USING ERRCODE = '23503';
 END IF;
 RETURN NEW;
END $$;
