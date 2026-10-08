ALTER TABLE "GoodsReceipt" ALTER COLUMN "orderId" DROP NOT NULL;
ALTER TABLE "AuditLog" ADD COLUMN "terminalId" UUID;
ALTER TABLE "AuthSession" ADD COLUMN "terminalId" UUID;
CREATE TABLE "Terminal" (id UUID PRIMARY KEY, name TEXT NOT NULL, "branchId" TEXT NOT NULL, "revokedAt" TIMESTAMP(3), "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "RealtimeEvent" (id BIGSERIAL PRIMARY KEY, "branchId" TEXT NOT NULL, type TEXT NOT NULL, data JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX "RealtimeEvent_branchId_id_idx" ON "RealtimeEvent"("branchId",id);
CREATE FUNCTION fitstore_stock_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP = 'INSERT' OR NEW.stock IS DISTINCT FROM OLD.stock THEN
 INSERT INTO "RealtimeEvent" ("branchId",type,data) VALUES (NEW."branchId",'stock.changed', jsonb_build_object('variantId',NEW.id,'qtyOnHand',NEW.stock));
 END IF; RETURN NEW; END $$;
CREATE TRIGGER stock_event AFTER INSERT OR UPDATE ON "Variant" FOR EACH ROW EXECUTE FUNCTION fitstore_stock_event();
CREATE FUNCTION fitstore_alert_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 INSERT INTO "RealtimeEvent" ("branchId",type,data) VALUES (NEW."branchId",'alert.created', jsonb_build_object('id',NEW.id,'type',NEW.type)); RETURN NEW; END $$;
CREATE TRIGGER alert_event AFTER INSERT ON "Alert" FOR EACH ROW EXECUTE FUNCTION fitstore_alert_event();
CREATE TABLE "MerchandiseOperation" (id UUID PRIMARY KEY, "branchId" TEXT NOT NULL, "userId" TEXT NOT NULL, "terminalId" UUID, "requestHash" TEXT NOT NULL, result JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "SupplierImportProfile" (id UUID PRIMARY KEY, "supplierId" UUID NOT NULL, "branchId" TEXT NOT NULL, mapping JSONB NOT NULL);
CREATE UNIQUE INDEX "SupplierImportProfile_supplierId_branchId_key" ON "SupplierImportProfile"("supplierId","branchId");
CREATE TABLE "SupplierCode" (id UUID PRIMARY KEY, "supplierId" UUID NOT NULL, "branchId" TEXT NOT NULL, code TEXT NOT NULL, "variantId" UUID NOT NULL);
CREATE UNIQUE INDEX "SupplierCode_supplierId_branchId_code_key" ON "SupplierCode"("supplierId","branchId",code);
CREATE TABLE "InvoiceDraft" (id UUID PRIMARY KEY, "branchId" TEXT NOT NULL, "userId" TEXT NOT NULL, "supplierId" UUID, lines JSONB NOT NULL, total DECIMAL(14,2), "attachmentId" UUID, "confirmedOperationId" UUID UNIQUE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE "InvoiceAttachment" (id UUID PRIMARY KEY, "branchId" TEXT NOT NULL, "userId" TEXT NOT NULL, mime TEXT NOT NULL, data BYTEA NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
