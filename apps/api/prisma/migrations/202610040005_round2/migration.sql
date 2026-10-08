ALTER TABLE "Customer" ADD COLUMN "creditLimit" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Customer" ADD CONSTRAINT customer_credit_limit_nonnegative CHECK ("creditLimit">=0);
ALTER TABLE "CreditNote" ADD COLUMN "redemptionCode" TEXT;
UPDATE "CreditNote" SET "redemptionCode"=upper(replace(gen_random_uuid()::text,'-',''));
ALTER TABLE "CreditNote" ALTER COLUMN "redemptionCode" SET NOT NULL;
CREATE UNIQUE INDEX "CreditNote_redemptionCode_key" ON "CreditNote" ("redemptionCode");
