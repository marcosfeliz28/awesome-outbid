-- PC-23: la normalización de la referencia (sin espacios, en minúsculas) dependía de la
-- configuración regional de la base: [[:space:]] reconoce el espacio duro (U+00A0) y el
-- U+FEFF según la instalación. Se fija la misma lista que usa \s en JavaScript
-- (normalizeReference) para que la API y el trigger decidan igual. Solo cambia la
-- función; no toca filas ni el trigger.
CREATE OR REPLACE FUNCTION nexora_platform_payment_reference_unique() RETURNS trigger AS $$
DECLARE
  sp constant text := '[\t\n\v\f\r ' || chr(160) || chr(5760) || chr(8192) || '-' || chr(8202) || chr(8232) || chr(8233) || chr(8239) || chr(8287) || chr(12288) || chr(65279) || ']+';
  ref text := lower(regexp_replace(NEW.reference, sp, '', 'g'));
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('PlatformPayment:' || NEW."tenantId"::text || ':' || ref, 0));
  IF EXISTS (
    SELECT 1 FROM "PlatformPayment" p
    WHERE p."tenantId" = NEW."tenantId" AND p."voidsPaymentId" IS NULL
      AND lower(regexp_replace(p.reference, sp, '', 'g')) = ref
      AND NOT EXISTS (SELECT 1 FROM "PlatformPayment" v WHERE v."voidsPaymentId" = p.id)
  ) THEN
    RAISE EXCEPTION 'Ya hay un pago vigente con esa referencia en la empresa.' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
