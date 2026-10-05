-- Ronda 7 (Claude): R6-03 de la auditoría de ChatGPT.
--
-- La versión original de 202610060001_round6_audit podía completar el total de
-- una recepción de orden sumando sólo las líneas con qty y cost numéricos: una
-- línea sin costo, sin cantidad, vacía o que no fuera objeto se ignoraba y el
-- total parcial quedaba como conciliado. Esa migración ya se corrigió para las
-- bases que todavía no la aplicaron; ésta repara las que sí la aplicaron.
--
-- Sólo toca recepciones de orden sin operación de Mercancía (las únicas que
-- completó ese paso) cuyas líneas no prueban el total: el total vuelve a NULL y
-- la recepción aparece "sin conciliar" en el reporte. El proveedor, que sí
-- viene de la orden, se conserva. Las recepciones que la API crea por la ruta
-- de la orden siempre guardan qty y cost numéricos, así que no cambian.
-- Re-ejecutable: una segunda vez no encuentra nada que cambiar.
UPDATE "GoodsReceipt" r SET "total" = NULL
WHERE r."total" IS NOT NULL
  AND r."orderId" IS NOT NULL
  AND r."operationId" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "MerchandiseOperation" op
     WHERE op."result"->>'receiptId' = r."id"::text)
  AND (
    jsonb_typeof(r."items") IS DISTINCT FROM 'array'
    OR (CASE WHEN jsonb_typeof(r."items") = 'array'
             THEN jsonb_array_length(r."items") ELSE 0 END) = 0
    OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(r."items") = 'array' THEN r."items" ELSE '[]'::jsonb END) i
       WHERE jsonb_typeof(i) IS DISTINCT FROM 'object'
          OR jsonb_typeof(i->'qty') IS DISTINCT FROM 'number'
          OR jsonb_typeof(i->'cost') IS DISTINCT FROM 'number'
          OR (CASE WHEN jsonb_typeof(i->'qty') = 'number'
                   THEN (i->>'qty')::numeric <= 0 ELSE true END)
          OR (CASE WHEN jsonb_typeof(i->'cost') = 'number'
                   THEN (i->>'cost')::numeric < 0 ELSE true END)));
