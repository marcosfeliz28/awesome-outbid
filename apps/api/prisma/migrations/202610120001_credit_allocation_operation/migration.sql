CREATE TABLE "CreditAllocationOperation" (
    "operationId" UUID NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "requestHash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditAllocationOperation_pkey" PRIMARY KEY ("operationId")
);
CREATE INDEX "CreditAllocationOperation_branchId_customerId_createdAt_idx"
    ON "CreditAllocationOperation"("branchId", "customerId", "createdAt");
