-- Solo para la base independiente del producto; no se despliega en la tienda.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "businessType" text NOT NULL DEFAULT 'general';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "trialEndsAt" timestamp(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerificationHash" text;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerificationExpiresAt" timestamp(3);
CREATE UNIQUE INDEX IF NOT EXISTS "User_emailVerificationHash_key" ON "User"("emailVerificationHash");
