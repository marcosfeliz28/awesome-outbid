-- Cobro de créditos por la administración: quién y cuándo cerró el crédito, y
-- quién recibió cada cobro. Aditiva: columnas nulas, sin relleno.
ALTER TABLE "Sale" ADD COLUMN "creditClosedAt" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN "creditClosedById" UUID;
ALTER TABLE "Payment" ADD COLUMN "receivedById" UUID;
-- Incentivo al cobrar: false para todo lo existente (no retroactivo).
ALTER TABLE "Sale" ADD COLUMN "incentiveOnCollection" BOOLEAN NOT NULL DEFAULT false;
