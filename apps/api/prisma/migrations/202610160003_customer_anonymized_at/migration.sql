ALTER TABLE "Customer" ADD COLUMN "anonymizedAt" TIMESTAMP(3);

-- Las anonimizaciones hechas antes de esta migración ya son irreversibles. El
-- marcador explícito evita que un PATCH posterior dependa del texto del nombre.
UPDATE "Customer"
SET "anonymizedAt" = COALESCE("updatedAt", "createdAt")
WHERE "active" = FALSE
  AND "name" LIKE 'Cliente anonimizado %'
  AND "anonymizedAt" IS NULL;
