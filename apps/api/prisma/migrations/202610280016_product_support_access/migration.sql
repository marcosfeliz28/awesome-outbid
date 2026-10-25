-- Ventana de acceso de soporte por usuario; null = desactivado.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "supportExpiresAt" TIMESTAMP(3);
