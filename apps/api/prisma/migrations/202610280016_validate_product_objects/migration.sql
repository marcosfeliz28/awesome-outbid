-- PC-08: las dos restricciones se crearon NOT VALID para no bloquear el
-- despliegue con adjuntos históricos. Validarlas después permite que la
-- comprobación posterior distinga una base limpia de filas incompatibles.
-- Nunca abortar la migración por una fila antigua: dejar NOTICE y conservar
-- convalidated=false para que post-deploy-check señale la reparación pendiente.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"InvoiceAttachment"'::regclass
      AND conname = 'InvoiceAttachment_object_location'
      AND NOT convalidated
  ) THEN
    BEGIN
      ALTER TABLE "InvoiceAttachment"
        VALIDATE CONSTRAINT "InvoiceAttachment_object_location";
    EXCEPTION WHEN check_violation THEN
      RAISE NOTICE 'PC-08: InvoiceAttachment_object_location sigue sin validar; revisar filas antiguas antes de activar objetos.';
    END;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = '"BillingRequest"'::regclass
      AND conname = 'BillingRequest_proof_location'
      AND NOT convalidated
  ) THEN
    BEGIN
      ALTER TABLE "BillingRequest"
        VALIDATE CONSTRAINT "BillingRequest_proof_location";
    EXCEPTION WHEN check_violation THEN
      RAISE NOTICE 'PC-08: BillingRequest_proof_location sigue sin validar; revisar filas antiguas antes de activar objetos.';
    END;
  END IF;
END $$;
