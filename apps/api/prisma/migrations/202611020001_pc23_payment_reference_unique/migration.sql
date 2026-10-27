-- PC-23: la referencia de un pago vigente no se repite en la misma empresa, también
-- en la base (hasta ahora solo la comprobaba el código). Aditiva: solo mira los
-- INSERT nuevos, no toca ni revisa filas existentes (no falla si ya hay repetidas).
-- No es un índice único porque la bitácora es inmutable: el pago anulado conserva su
-- referencia y esta debe poder anotarse de nuevo con el pago corregido; "vigente"
-- depende de otra fila (la anulación), algo que un índice parcial no puede expresar.
-- El bloqueo por empresa y referencia serializa dos inserciones simultáneas.
CREATE OR REPLACE FUNCTION nexora_platform_payment_reference_unique() RETURNS trigger AS $$
DECLARE ref text := lower(regexp_replace(NEW.reference, '[[:space:]]+', '', 'g'));
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('PlatformPayment:' || NEW."tenantId"::text || ':' || ref, 0));
  IF EXISTS (
    SELECT 1 FROM "PlatformPayment" p
    WHERE p."tenantId" = NEW."tenantId" AND p."voidsPaymentId" IS NULL
      AND lower(regexp_replace(p.reference, '[[:space:]]+', '', 'g')) = ref
      AND NOT EXISTS (SELECT 1 FROM "PlatformPayment" v WHERE v."voidsPaymentId" = p.id)
  ) THEN
    RAISE EXCEPTION 'Ya hay un pago vigente con esa referencia en la empresa.' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS platform_payment_reference_unique ON "PlatformPayment";
CREATE TRIGGER platform_payment_reference_unique BEFORE INSERT ON "PlatformPayment"
  FOR EACH ROW WHEN (NEW."voidsPaymentId" IS NULL)
  EXECUTE FUNCTION nexora_platform_payment_reference_unique();
