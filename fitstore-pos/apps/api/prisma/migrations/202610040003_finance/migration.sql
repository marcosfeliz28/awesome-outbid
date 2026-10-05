ALTER TABLE "Sale" ADD COLUMN "creditBalance" DECIMAL(14,2) NOT NULL DEFAULT 0, ADD COLUMN "creditDueDate" TIMESTAMP(3), ADD COLUMN ncf TEXT, ADD COLUMN "ncfType" TEXT, ADD COLUMN "recipientLegalId" TEXT, ADD COLUMN "fiscalStatus" TEXT NOT NULL DEFAULT 'not_issued';
CREATE UNIQUE INDEX "Sale_ncf_key" ON "Sale" (ncf);
ALTER TABLE "Sale" ADD CONSTRAINT credit_balance_nonnegative CHECK ("creditBalance">=0);
ALTER TABLE "Payment" ADD COLUMN "cashSessionId" UUID, ADD COLUMN "creditNoteId" UUID, ADD COLUMN "entryType" TEXT NOT NULL DEFAULT 'sale', ADD COLUMN "idempotencyKey" UUID, ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment" ("idempotencyKey");
UPDATE "Payment" p SET "cashSessionId"=s."cashSessionId", "createdAt"=s."createdAt" FROM "Sale" s WHERE s.id=p."saleId";
ALTER TABLE "CreditNote" ADD CONSTRAINT credit_note_balance_valid CHECK (balance>=0 AND balance<=amount);
ALTER TABLE "SaleReturn" ADD COLUMN "refundAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
UPDATE "SaleReturn" SET "refundAmount"=total;
