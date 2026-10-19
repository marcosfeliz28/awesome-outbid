-- I-01: una categoría que exige vencimiento también exige lote (la fecha vive en el lote).
UPDATE "Category" SET "requiresLot" = true WHERE "requiresExpiry" AND NOT "requiresLot";
