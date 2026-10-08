ALTER TABLE "Variant" DROP CONSTRAINT stock_nonnegative;
CREATE FUNCTION enforce_negative_stock_setting() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.stock < 0 AND (
    NOT EXISTS(SELECT 1 FROM "Settings" WHERE id=NEW."branchId" AND data->>'allowNegativeStock'='true')
    OR EXISTS(SELECT 1 FROM "Product" p JOIN "Category" c ON c.id=p."categoryId" WHERE p.id=NEW."productId" AND c."requiresLot")
  ) THEN RAISE EXCEPTION 'Stock negativo no autorizado' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER enforce_negative_stock BEFORE INSERT OR UPDATE OF stock ON "Variant" FOR EACH ROW EXECUTE FUNCTION enforce_negative_stock_setting();
