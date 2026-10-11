CREATE TABLE "SaleVoidRequest" (
  "id" UUID NOT NULL,
  "saleId" UUID NOT NULL,
  "requestedById" UUID NOT NULL,
  "reviewedById" UUID,
  "operationId" UUID NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "resolutionNote" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "branchId" TEXT NOT NULL DEFAULT 'main',
  CONSTRAINT "SaleVoidRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sale_void_request_status_valid" CHECK ("status" IN ('pending', 'approved', 'rejected', 'cancelled')),
  CONSTRAINT "sale_void_request_reason_valid" CHECK ("reasonCode" IN ('customer_request', 'duplicate', 'payment_error', 'item_error', 'other') AND length(trim("reason")) BETWEEN 8 AND 500),
  CONSTRAINT "SaleVoidRequest_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SaleVoidRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SaleVoidRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SaleVoidRequest_operationId_key" ON "SaleVoidRequest"("operationId");
CREATE UNIQUE INDEX "sale_void_request_one_pending_per_sale" ON "SaleVoidRequest"("saleId") WHERE "status" = 'pending';
CREATE INDEX "SaleVoidRequest_branchId_status_requestedAt_idx" ON "SaleVoidRequest"("branchId", "status", "requestedAt");
CREATE INDEX "SaleVoidRequest_saleId_idx" ON "SaleVoidRequest"("saleId");
CREATE INDEX "SaleVoidRequest_requestedById_requestedAt_idx" ON "SaleVoidRequest"("requestedById", "requestedAt");
