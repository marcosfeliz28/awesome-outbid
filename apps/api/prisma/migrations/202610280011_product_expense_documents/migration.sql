-- PC-11: columnas aditivas; los gastos históricos conservan sus valores.
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "ncf" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "itbis" DECIMAL(14,2);
