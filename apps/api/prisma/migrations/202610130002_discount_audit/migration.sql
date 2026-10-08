ALTER TABLE "Sale"
  ADD COLUMN "discountReason" TEXT,
  ADD COLUMN "discountRule" TEXT,
  ADD COLUMN "discountApprovedBy" UUID,
  ADD COLUMN "discountApprovedName" TEXT,
  ADD COLUMN "discountApprovedRole" TEXT;
