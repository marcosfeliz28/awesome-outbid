-- N-08 (auditoría de seguridad v2): una contraseña temporal (alta de usuario o
-- «Restablecer contraseña») vence y no sirve indefinidamente. Prefijo 2206…
-- distinto de las ramas hermanas (docs/MIGRACIONES_SEGURAS.md, M2).
--
-- Idempotente y sin riesgo: columna nueva nula (no reescribe la tabla). Las
-- cuentas que ya esperan un cambio de contraseña reciben el plazo completo a
-- partir de ahora (7 días, igual que en admin.ts), para no dejar fuera a
-- nadie de golpe al desplegar.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordExpiresAt" TIMESTAMP(3);

UPDATE "User"
   SET "passwordExpiresAt" = timezone('UTC', now()) + interval '7 days'
 WHERE "mustChangePassword" = true
   AND "passwordExpiresAt" IS NULL;
