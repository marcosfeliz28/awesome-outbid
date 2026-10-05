-- Orden de publicación independiente del orden en que empezaron las transacciones.
-- El bloqueo se toma al final, cuando las operaciones ya adquirieron sus locks de negocio.
CREATE OR REPLACE FUNCTION fitstore_stock_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP = 'INSERT' OR NEW.stock IS DISTINCT FROM OLD.stock THEN
 PERFORM pg_advisory_xact_lock(734918203);
 INSERT INTO "RealtimeEvent" ("branchId",type,data) VALUES (NEW."branchId",'stock.changed', jsonb_build_object('variantId',NEW.id,'qtyOnHand',NEW.stock));
 END IF; RETURN NEW; END $$;
CREATE OR REPLACE FUNCTION fitstore_alert_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 PERFORM pg_advisory_xact_lock(734918203);
 INSERT INTO "RealtimeEvent" ("branchId",type,data) VALUES (NEW."branchId",'alert.created', jsonb_build_object('id',NEW.id,'type',NEW.type)); RETURN NEW; END $$;
DROP TRIGGER stock_event ON "Variant";
DROP TRIGGER alert_event ON "Alert";
CREATE CONSTRAINT TRIGGER stock_event AFTER INSERT OR UPDATE ON "Variant" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fitstore_stock_event();
CREATE CONSTRAINT TRIGGER alert_event AFTER INSERT ON "Alert" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fitstore_alert_event();
