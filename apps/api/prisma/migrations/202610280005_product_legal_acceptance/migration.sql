-- PC-01: datos aditivos; nunca asignar consentimiento implícito a empresas ya existentes.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "termsVersion" text;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" timestamp(3);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "privacyVersion" text;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "privacyAcceptedAt" timestamp(3);
